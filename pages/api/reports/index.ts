import { NextApiRequest, NextApiResponse } from "next";
import { DEBATE_CATEGORY, DEBATE_REPORT_HIDE_COUNT } from "@libs/shared/debateFormat";
import { TOWN_REPORT_HIDE_COUNT } from "@libs/shared/townTalk";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { resolveReportTarget } from "@libs/server/reports";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
import { parsePositiveIntId } from "@libs/shared/normalize";
import {
  OTHER_REASON,
  REPORT_DETAIL_MAX,
  REPORT_DETAIL_MIN_FOR_OTHER,
  ReportStatus,
  isReportTargetType,
  isValidReportReason,
} from "@libs/shared/report";

/**
 * POST /api/reports — 게시글·댓글·상품·채팅방·사용자·혈통 통합 신고 접수.
 * 경매 신고는 /api/auctions/[id]/report 를 그대로 쓴다.
 */
export interface ReportResponse extends ResponseType {
  report?: {
    id: number;
    status: ReportStatus;
    createdAt: string;
  };
  error?: string;
  errorCode?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ReportResponse>) {
  const userId = req.user?.id;
  // 계약상 401 도 errorCode 를 주기 위해 withHandler 의 isPrivate 대신 여기서 확인한다.
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      errorCode: "REPORT_AUTH_REQUIRED",
    });
  }

  const body = req.body ?? {};

  const targetType = body.targetType;
  if (!isReportTargetType(targetType)) {
    return res.status(400).json({
      success: false,
      error: "신고 대상 유형이 올바르지 않습니다.",
      errorCode: "REPORT_INVALID_TARGET_TYPE",
    });
  }

  const targetId = parsePositiveIntId(body.targetId);
  if (targetId === null) {
    return res.status(400).json({
      success: false,
      error: "신고 대상 정보가 올바르지 않습니다.",
      errorCode: "REPORT_INVALID_TARGET_ID",
    });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!isValidReportReason(targetType, reason)) {
    return res.status(400).json({
      success: false,
      error: "신고 사유를 선택해주세요.",
      errorCode: "REPORT_INVALID_REASON",
    });
  }

  const detail = body.detail == null ? "" : String(body.detail).trim();
  if (detail.length > REPORT_DETAIL_MAX) {
    return res.status(400).json({
      success: false,
      error: `신고 내용은 ${REPORT_DETAIL_MAX}자 이하로 입력해주세요.`,
      errorCode: "REPORT_INVALID_DETAIL_LENGTH",
    });
  }
  if (reason === OTHER_REASON && detail.length < REPORT_DETAIL_MIN_FOR_OTHER) {
    return res.status(400).json({
      success: false,
      error: `기타 사유는 신고 내용을 ${REPORT_DETAIL_MIN_FOR_OTHER}자 이상 입력해주세요.`,
      errorCode: "REPORT_DETAIL_REQUIRED",
    });
  }

  const reporter = await client.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!reporter || reporter.status !== "ACTIVE") {
    return res.status(403).json({
      success: false,
      error: "현재 계정 상태에서는 신고할 수 없습니다.",
      errorCode: "REPORT_ACCOUNT_RESTRICTED",
    });
  }

  const target = await resolveReportTarget(targetType, targetId, userId);
  if (!target.ok) {
    return res.status(target.status).json({
      success: false,
      error: target.error,
      errorCode: target.errorCode,
    });
  }

  if (target.reportedUserId === userId) {
    return res.status(400).json({
      success: false,
      error:
        targetType === "USER"
          ? "본인 계정은 신고할 수 없습니다."
          : "본인이 작성한 콘텐츠는 신고할 수 없습니다.",
      errorCode: "REPORT_SELF_NOT_ALLOWED",
    });
  }

  const openReport = await client.report.findFirst({
    where: { targetType, targetId, reporterId: userId, status: "OPEN" },
    select: { id: true },
  });
  if (openReport) {
    return res.status(400).json({
      success: false,
      error: "이미 접수된 신고가 있습니다. 운영자 검토를 기다려주세요.",
      errorCode: "REPORT_ALREADY_EXISTS",
    });
  }

  const report = await client.report.create({
    data: {
      targetType,
      targetId,
      reporterId: userId,
      reportedUserId: target.reportedUserId,
      reason,
      detail: detail || null,
    },
    select: { id: true, status: true, createdAt: true },
  });

  // 자동 가림(앱 docs/prd/live-talk.md §4.4): 토론 글 2건, 사랑방 메시지 3건이면 운영자 확인 전까지 가린다.
  await autoHideReported(targetType, targetId);

  await captureServerEvent(userId, "report_submitted", {
    target_type: targetType,
    reason,
    platform: resolveClientPlatform(req),
  });

  return res.json({
    success: true,
    report: {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    },
  });
}

async function autoHideReported(targetType: string, targetId: number) {
  if (targetType !== "POST" && targetType !== "TOWN_MESSAGE") return;
  const openCount = await client.report.count({
    where: { targetType: targetType as "POST" | "TOWN_MESSAGE", targetId, status: "OPEN" },
  });
  if (targetType === "TOWN_MESSAGE" && openCount >= TOWN_REPORT_HIDE_COUNT) {
    await client.townMessage.updateMany({ where: { id: targetId, isHidden: false }, data: { isHidden: true } });
  }
  if (targetType === "POST" && openCount >= DEBATE_REPORT_HIDE_COUNT) {
    await client.post.updateMany({
      where: { id: targetId, category: DEBATE_CATEGORY, isHidden: false },
      data: { isHidden: true },
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: false,
  })
);
