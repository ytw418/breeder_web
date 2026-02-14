import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { hasAdminAccess } from "./_utils";
import {
  AuctionReportAction,
  AuctionReportStatus,
  UserStatus,
} from "@prisma/client";
import { createNotification } from "@libs/server/notification";

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
  const adminUserId = req.session.user?.id;
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
    const { reportId, decision, action = "NONE", note = "" } = req.body || {};
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

    if (parsedDecision === "REJECTED" && parsedAction !== "NONE") {
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

    const shouldBanUser =
      parsedAction === "BAN_USER" || parsedAction === "STOP_AUCTION_AND_BAN";
    const shouldStopAuction =
      parsedAction === "STOP_AUCTION" || parsedAction === "STOP_AUCTION_AND_BAN";

    if (shouldBanUser) {
      await client.user.update({
        where: { id: target.reportedUserId },
        data: { status: "BANNED" },
      });
    }

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
      }
    }

    const next = await client.auctionReport.update({
      where: { id: parsedReportId },
      data: {
        status: parsedDecision,
        resolutionAction: parsedAction,
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

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
