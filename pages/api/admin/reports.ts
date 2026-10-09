import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  Prisma,
  ReportAction,
  ReportStatus,
  ReportTargetType,
  UserStatus,
} from "@prisma/client";
import {
  ReportTargetSnapshot,
  buildTargetSnapshots,
  fromLegacyAction,
  isReportContentAction,
  isReportResolutionError,
  isReportUserActionType,
  resolveReport,
  type ReportContentAction,
  type ReportUserAction,
} from "@libs/server/reports";
import { isReportAction, isReportStatus, isReportTargetType } from "@libs/shared/report";

export type { ReportTargetSnapshot };

export interface AdminReportItem {
  id: number;
  targetType: ReportTargetType;
  targetId: number;
  reporterId: number;
  reportedUserId: number;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  resolutionAction: ReportAction;
  contentAction: "HIDE" | "UNHIDE" | "DELETE" | null;
  sanctionId: number | null;
  resolutionNote: string | null;
  resolvedBy: number | null;
  resolvedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  reporter?: {
    id: number;
    name: string;
    status: UserStatus;
  };
  reportedUser?: {
    id: number;
    name: string;
    status: UserStatus;
  };
  /** 대상 스냅샷. CHAT_ROOM 이면 messages 에 최근 20개(오래된 → 최신). */
  target: ReportTargetSnapshot;
}

export interface AdminReportsResponse extends ResponseType {
  reports: AdminReportItem[];
  counts: Record<ReportStatus, number>;
  /** POST 만: 함께 닫은 신고 id, 콘텐츠가 이미 없어 콘텐츠 조치를 건너뛰었는지, 만든 제재 id */
  closedReportIds?: number[];
  contentSkipped?: boolean;
  contentFailed?: boolean;
  sanctionId?: number | null;
  errorCode?: string;
  /** GET 만: 현재 페이지(1부터)와 다음 페이지 존재 여부 */
  page?: number;
  hasMore?: boolean;
  error?: string;
}

/** GET 한 페이지의 신고 수. 대상 스냅샷(채팅방 메시지 등) 조회량의 상한이기도 하다. */
export const ADMIN_REPORT_PAGE_SIZE = 50;

const EMPTY_COUNTS: Record<ReportStatus, number> = {
  OPEN: 0,
  RESOLVED: 0,
  REJECTED: 0,
};

const reportInclude = {
  reporter: { select: { id: true, name: true, status: true } },
  reportedUser: { select: { id: true, name: true, status: true } },
} satisfies Prisma.ReportInclude;

type ReportWithUsers = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

async function getReportCounts() {
  const grouped = await client.report.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return grouped.reduce<Record<ReportStatus, number>>(
    (acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    },
    { ...EMPTY_COUNTS }
  );
}

async function withTargets(reports: ReportWithUsers[]): Promise<AdminReportItem[]> {
  const snapshots = await buildTargetSnapshots(reports);
  return reports.map((report, index) => ({ ...report, target: snapshots[index] }));
}

async function handler(req: NextApiRequest, res: NextApiResponse<AdminReportsResponse>) {
  const adminUserId = req.user?.id;
  const isAdmin = await hasAdminAccess(adminUserId);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다.", reports: [], counts: EMPTY_COUNTS });
  }

  const fail = (status: number, error: string) =>
    res.status(status).json({ success: false, error, reports: [], counts: EMPTY_COUNTS });

  if (req.method === "GET") {
    const statusFilter = String(req.query.status || "ALL");
    const targetTypeFilter = String(req.query.targetType || "ALL");
    const where: Prisma.ReportWhereInput = {};
    if (isReportStatus(statusFilter)) where.status = statusFilter;
    if (isReportTargetType(targetTypeFilter)) where.targetType = targetTypeFilter;

    const pageNumber = Number(req.query.page);
    const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;

    const [rows, counts] = await Promise.all([
      client.report.findMany({
        where,
        include: reportInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        // 다음 페이지가 있는지 알기 위해 1건 더 가져온다.
        take: ADMIN_REPORT_PAGE_SIZE + 1,
        skip: (page - 1) * ADMIN_REPORT_PAGE_SIZE,
      }),
      getReportCounts(),
    ]);
    const hasMore = rows.length > ADMIN_REPORT_PAGE_SIZE;

    return res.json({
      success: true,
      reports: await withTargets(rows.slice(0, ADMIN_REPORT_PAGE_SIZE)),
      counts,
      page,
      hasMore,
    });
  }

  if (req.method === "POST") {
    /**
     * body: { reportId, decision: RESOLVED|REJECTED, contentAction?: NONE|HIDE|DELETE,
     *         userAction?: { type: WARNING|SUSPENSION|BAN, days?, reasonCode?, messageToUser?, internalNote? },
     *         closeSameTarget?: boolean, note? }
     * 구 방식 action(NONE|REMOVE_CONTENT|BAN_USER|REMOVE_CONTENT_AND_BAN)도 받는다(콘텐츠 삭제는 숨김으로 바뀐다).
     */
    const { reportId, decision, action, contentAction, userAction, closeSameTarget, note = "" } = req.body || {};
    const parsedReportId = Number(reportId);
    const parsedDecision = String(decision || "");
    const parsedNote = String(note || "").trim().slice(0, 500);

    if (!Number.isInteger(parsedReportId) || parsedReportId < 1) {
      return fail(400, "유효하지 않은 신고 ID입니다.");
    }

    if (!isReportStatus(parsedDecision) || parsedDecision === "OPEN") {
      return fail(400, "처리 상태는 RESOLVED 또는 REJECTED만 가능합니다.");
    }

    let parsedContentAction: ReportContentAction = "NONE";
    let parsedUserAction: ReportUserAction | null = null;
    const usesNewShape = contentAction != null || userAction != null;
    if (usesNewShape) {
      if (contentAction != null && !isReportContentAction(contentAction)) {
        return fail(400, "유효하지 않은 콘텐츠 조치입니다.");
      }
      parsedContentAction = contentAction ?? "NONE";
      if (userAction != null) {
        if (typeof userAction !== "object" || !isReportUserActionType(userAction.type)) {
          return fail(400, "유효하지 않은 사용자 조치입니다.");
        }
        parsedUserAction = {
          type: userAction.type,
          days: userAction.days == null ? null : Number(userAction.days),
          reasonCode: typeof userAction.reasonCode === "string" ? userAction.reasonCode : null,
          messageToUser: typeof userAction.messageToUser === "string" ? userAction.messageToUser : null,
          internalNote: typeof userAction.internalNote === "string" ? userAction.internalNote : null,
        };
      }
    } else {
      const legacy = String(action || "NONE");
      if (!isReportAction(legacy)) {
        return fail(400, "유효하지 않은 처리 액션입니다.");
      }
      ({ contentAction: parsedContentAction, userAction: parsedUserAction } = fromLegacyAction(legacy));
    }

    try {
      const result = await resolveReport({
        reportId: parsedReportId,
        actorId: adminUserId!,
        decision: parsedDecision,
        contentAction: parsedContentAction,
        userAction: parsedUserAction,
        closeSameTarget: closeSameTarget === true,
        note: parsedNote || null,
      });

      const [rows, counts] = await Promise.all([
        client.report.findMany({
          where: { id: { in: result.reportIds } },
          include: reportInclude,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        getReportCounts(),
      ]);

      return res.json({
        success: true,
        reports: await withTargets(rows),
        counts,
        closedReportIds: result.reportIds,
        contentSkipped: result.contentSkipped,
        contentFailed: result.contentFailed,
        sanctionId: result.sanctionId,
      });
    } catch (error) {
      if (isReportResolutionError(error)) {
        return res
          .status(error.status)
          .json({ success: false, error: error.message, errorCode: error.code, reports: [], counts: EMPTY_COUNTS });
      }
      throw error;
    }
  }

  return fail(405, "지원하지 않는 메서드입니다.");
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
