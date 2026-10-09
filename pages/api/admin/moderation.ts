import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  ModerationResult,
  MODERATION_TARGET_NOT_FOUND_MESSAGE,
  applyModeration,
  isModerationAction,
  isModerationTargetNotFound,
  isModerationTargetType,
} from "@libs/server/moderation";
import { isSanctionReasonCode } from "@libs/shared/sanction";

export interface AdminModerationResponse extends ResponseType {
  result?: ModerationResult;
  error?: string;
  errorCode?: "MODERATION_TARGET_NOT_FOUND";
}

/**
 * 운영자 조치: 게시글·댓글·상품·경매·혈통 숨김 / 숨김 해제 / 삭제.
 * body: { targetType: "POST"|"COMMENT"|"PRODUCT"|"AUCTION"|"BLOODLINE_CARD", targetId, action: "hide"|"unhide"|"delete", reasonCode?, reason? }
 * reasonCode 는 제재 사유 코드(libs/shared/sanction.ts)다. 관리자 화면은 필수로 보내고, 구버전 앱 ⋯ 메뉴 호환을 위해 서버는 선택값으로 받는다.
 * 작성자에게 사유가 든 운영 알림(MODERATION)을 보낸다.
 * 혈통(BLOODLINE_CARD)의 delete 는 회수(REVOKED)이고, 뿌리 혈통이면 그 출처 카드도 함께 회수한다(libs/server/moderation).
 */
async function handler(req: NextApiRequest, res: NextApiResponse<AdminModerationResponse>) {
  const actorId = req.user?.id;
  if (!actorId || !(await hasAdminAccess(actorId))) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  const { targetType, targetId, action, reason, reasonCode } = req.body || {};
  const parsedTargetId = Number(targetId);
  if (!isModerationTargetType(targetType)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 대상 유형입니다." });
  }
  if (!Number.isInteger(parsedTargetId) || parsedTargetId < 1) {
    return res.status(400).json({ success: false, error: "유효하지 않은 대상 ID입니다." });
  }
  if (!isModerationAction(action)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 조치입니다." });
  }
  if (reasonCode != null && !isSanctionReasonCode(reasonCode)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 사유입니다." });
  }

  try {
    const result = await applyModeration({
      actorId,
      targetType,
      targetId: parsedTargetId,
      action,
      reason: typeof reason === "string" ? reason : null,
      reasonCode: reasonCode ?? null,
    });
    return res.json({ success: true, result });
  } catch (error) {
    if (isModerationTargetNotFound(error)) {
      return res.status(404).json({
        success: false,
        error: MODERATION_TARGET_NOT_FOUND_MESSAGE,
        errorCode: "MODERATION_TARGET_NOT_FOUND",
      });
    }
    throw error;
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    isPrivate: false,
    handler,
  })
);
