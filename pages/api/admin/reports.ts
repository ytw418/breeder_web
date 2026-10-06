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
  applyReportAction,
  buildTargetSnapshots,
} from "@libs/server/reports";
import {
  isRemovableReportTarget,
  isReportAction,
  isReportStatus,
  isReportTargetType,
} from "@libs/shared/report";

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
    const { reportId, decision, action = "NONE", note = "" } = req.body || {};
    const parsedReportId = Number(reportId);
    const parsedDecision = String(decision || "");
    const parsedAction = String(action || "");
    const parsedNote = String(note || "").trim().slice(0, 500);

    if (!Number.isInteger(parsedReportId) || parsedReportId < 1) {
      return fail(400, "유효하지 않은 신고 ID입니다.");
    }

    if (!isReportStatus(parsedDecision) || parsedDecision === "OPEN") {
      return fail(400, "처리 상태는 RESOLVED 또는 REJECTED만 가능합니다.");
    }

    if (!isReportAction(parsedAction)) {
      return fail(400, "유효하지 않은 처리 액션입니다.");
    }

    if (parsedDecision === "REJECTED" && parsedAction !== "NONE") {
      return fail(400, "신고 기각(REJECTED) 처리에서는 제재 액션을 함께 사용할 수 없습니다.");
    }

    const target = await client.report.findUnique({
      where: { id: parsedReportId },
      select: {
        id: true,
        status: true,
        targetType: true,
        targetId: true,
        reportedUserId: true,
      },
    });
    if (!target) {
      return fail(404, "신고를 찾을 수 없습니다.");
    }

    if (target.status !== "OPEN") {
      return fail(400, "이미 처리된 신고입니다.");
    }

    const removesContent =
      parsedAction === "REMOVE_CONTENT" || parsedAction === "REMOVE_CONTENT_AND_BAN";
    if (removesContent && !isRemovableReportTarget(target.targetType)) {
      return fail(400, "채팅·사용자 신고에는 콘텐츠 삭제를 적용할 수 없습니다.");
    }

    await applyReportAction(target, parsedAction, adminUserId!);

    const next = await client.report.update({
      where: { id: parsedReportId },
      data: {
        status: parsedDecision,
        resolutionAction: parsedAction,
        resolutionNote: parsedNote || null,
        resolvedBy: adminUserId || null,
        resolvedAt: new Date(),
      },
      include: reportInclude,
    });

    const counts = await getReportCounts();

    return res.json({
      success: true,
      reports: await withTargets([next]),
      counts,
    });
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
