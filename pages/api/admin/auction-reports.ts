import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  AuctionReportAction,
  AuctionReportStatus,
  UserStatus,
} from "@prisma/client";
import { createNotification } from "@libs/server/notification";
import { isReportUserActionType, type ReportUserAction } from "@libs/server/reports";
import { isSanctionError, issueSanction } from "@libs/server/sanctions";
import { defaultSanctionReason, reporterActionMessage } from "@libs/shared/sanction";

const REPORT_STATUS = new Set<AuctionReportStatus>(["OPEN", "RESOLVED", "REJECTED"]);
const REPORT_ACTION = new Set<AuctionReportAction>([
  "NONE",
  "STOP_AUCTION",
  "BAN_USER",
  "STOP_AUCTION_AND_BAN",
]);

export interface AdminAuctionReportItem {
  id: number;
  auctionId: number;
  reporterId: number;
  reportedUserId: number;
  reason: string;
  detail: string;
  status: AuctionReportStatus;
  resolutionAction: AuctionReportAction;
  resolutionNote: string | null;
  resolvedBy: number | null;
  resolvedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  auction?: {
    id: number;
    title: string;
    status: string;
  };
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
}

export interface AdminAuctionReportsResponse extends ResponseType {
  reports: AdminAuctionReportItem[];
  counts: Record<AuctionReportStatus, number>;
  error?: string;
}

const EMPTY_COUNTS: Record<AuctionReportStatus, number> = {
  OPEN: 0,
  RESOLVED: 0,
  REJECTED: 0,
};

async function getReportCounts() {
  const grouped = await client.auctionReport.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  });

  return grouped.reduce<Record<AuctionReportStatus, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, { ...EMPTY_COUNTS });
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminAuctionReportsResponse>
) {
  const adminUserId = req.user?.id;
  const isAdmin = await hasAdminAccess(adminUserId);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다.", reports: [], counts: EMPTY_COUNTS });
  }

  if (req.method === "GET") {
    const statusFilter = String(req.query.status || "ALL");
    const where =
      statusFilter === "ALL" || !REPORT_STATUS.has(statusFilter as AuctionReportStatus)
        ? {}
        : { status: statusFilter as AuctionReportStatus };

    const [reports, counts] = await Promise.all([
      client.auctionReport.findMany({
        where,
        include: {
          auction: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      getReportCounts(),
    ]);

    return res.json({
      success: true,
      reports,
      counts,
    });
  }

  if (req.method === "POST") {
    /**
     * body: { reportId, decision, action?: NONE|STOP_AUCTION|BAN_USER|STOP_AUCTION_AND_BAN,
     *         userAction?: { type: WARNING|SUSPENSION|BAN, days?, reasonCode?, messageToUser?, internalNote? }, note? }
     * 사용자 조치는 일반 신고와 같은 제재 서비스(issueSanction)를 거친다(앱 docs/prd/admin-moderation.md F-12).
     * 구 action 의 BAN 은 userAction 이 없을 때 영구 정지 제재로 바꾼다.
     */
    const { reportId, decision, action = "NONE", note = "", userAction } = req.body || {};
    const parsedReportId = Number(reportId);
    const parsedDecision = String(decision || "") as AuctionReportStatus;
    const parsedAction = String(action || "") as AuctionReportAction;
    const parsedNote = String(note || "").trim().slice(0, 500);

    if (Number.isNaN(parsedReportId)) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 신고 ID입니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    if (!REPORT_STATUS.has(parsedDecision) || parsedDecision === "OPEN") {
      return res.status(400).json({
        success: false,
        error: "처리 상태는 RESOLVED 또는 REJECTED만 가능합니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    if (!REPORT_ACTION.has(parsedAction)) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 처리 액션입니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    if (userAction != null && (typeof userAction !== "object" || !isReportUserActionType(userAction.type))) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 사용자 조치입니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    if (parsedDecision === "REJECTED" && (parsedAction !== "NONE" || userAction != null)) {
      return res.status(400).json({
        success: false,
        error: "신고 기각(REJECTED) 처리에서는 제재 액션을 함께 사용할 수 없습니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    const target = await client.auctionReport.findUnique({
      where: { id: parsedReportId },
      select: {
        id: true,
        status: true,
        auctionId: true,
        reportedUserId: true,
        reporterId: true,
        reason: true,
      },
    });
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "신고를 찾을 수 없습니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    if (target.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        error: "이미 처리된 신고입니다.",
        reports: [],
        counts: EMPTY_COUNTS,
      });
    }

    const legacyBan = parsedAction === "BAN_USER" || parsedAction === "STOP_AUCTION_AND_BAN";
    const shouldStopAuction =
      parsedAction === "STOP_AUCTION" || parsedAction === "STOP_AUCTION_AND_BAN";
    const sanctionInput: ReportUserAction | null = userAction
      ? {
          type: userAction.type,
          days: userAction.days == null ? null : Number(userAction.days),
          reasonCode: typeof userAction.reasonCode === "string" ? userAction.reasonCode : null,
          messageToUser: typeof userAction.messageToUser === "string" ? userAction.messageToUser : null,
          internalNote: typeof userAction.internalNote === "string" ? userAction.internalNote : null,
        }
      : legacyBan
        ? { type: "BAN" }
        : null;

    // 사용자 제재를 먼저 한다(거절되면 경매를 건드리지 않고 그대로 돌려준다).
    let sanctionId: number | null = null;
    if (sanctionInput) {
      const reasonCode = sanctionInput.reasonCode || defaultSanctionReason(target.reason);
      const auction = await client.auction.findUnique({
        where: { id: target.auctionId },
        select: { title: true },
      });
      try {
        const { sanction } = await issueSanction({
          actorId: adminUserId!,
          userId: target.reportedUserId,
          type: sanctionInput.type,
          days: sanctionInput.days,
          reasonCode,
          messageToUser:
            sanctionInput.messageToUser?.trim() ||
            (reasonCode === "OTHER" ? "운영정책 위반이 확인되었어요." : null),
          internalNote: sanctionInput.internalNote,
          auctionReportId: target.id,
          target: { type: "AUCTION", id: target.auctionId, title: auction?.title ?? null },
        });
        sanctionId = sanction.id;
      } catch (error) {
        if (isSanctionError(error)) {
          return res.status(error.status).json({
            success: false,
            error: error.message,
            errorCode: error.code,
            reports: [],
            counts: EMPTY_COUNTS,
          });
        }
        throw error;
      }
    }

    let auctionStopped = false;
    if (shouldStopAuction) {
      const targetAuction = await client.auction.findUnique({
        where: { id: target.auctionId },
        select: { id: true, status: true, userId: true, title: true },
      });

      if (targetAuction && targetAuction.status === "진행중") {
        await client.auction.update({
          where: { id: targetAuction.id },
          data: {
            status: "취소",
            winnerId: null,
          },
        });

        await createNotification({
          type: "AUCTION_END",
          userId: targetAuction.userId,
          senderId: adminUserId || targetAuction.userId,
          message: `"${targetAuction.title}" 경매가 신고 처리로 중단(취소)되었습니다.`,
          targetId: targetAuction.id,
          targetType: "auction",
          allowSelf: true,
          dedupe: true,
        });
        auctionStopped = true;
      }
    }

    const banned = sanctionInput?.type === "BAN";
    const resolutionAction: AuctionReportAction =
      shouldStopAuction && banned
        ? "STOP_AUCTION_AND_BAN"
        : shouldStopAuction
          ? "STOP_AUCTION"
          : banned
            ? "BAN_USER"
            : "NONE";

    // 신고자 알림은 조치가 하나 이상 적용됐을 때만(기각·조치 없음은 보내지 않는다).
    if (parsedDecision === "RESOLVED" && (auctionStopped || sanctionId != null)) {
      await createNotification({
        type: "MODERATION",
        userId: target.reporterId,
        senderId: adminUserId!,
        message: reporterActionMessage("AUCTION"),
      });
    }

    const next = await client.auctionReport.update({
      where: { id: parsedReportId },
      data: {
        status: parsedDecision,
        resolutionAction,
        sanctionId,
        resolutionNote: parsedNote || null,
        resolvedBy: adminUserId || null,
        resolvedAt: new Date(),
      },
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    const counts = await getReportCounts();

    return res.json({
      success: true,
      reports: [next],
      counts,
    });
  }

  return res.status(405).json({
    success: false,
    error: "지원하지 않는 메서드입니다.",
    reports: [],
    counts: EMPTY_COUNTS,
  });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
