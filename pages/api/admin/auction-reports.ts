import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { hasAdminAccess } from "./_utils";
import {
  AuctionReportAction,
  AuctionReportItem,
  AuctionReportStatus,
  readAuctionReports,
  updateAuctionReport,
} from "@libs/server/auctionReportStore";
import { UserStatus } from "@prisma/client";
import { createNotification } from "@libs/server/notification";

const REPORT_STATUS = new Set<AuctionReportStatus>(["OPEN", "RESOLVED", "REJECTED"]);
const REPORT_ACTION = new Set<AuctionReportAction>([
  "NONE",
  "STOP_AUCTION",
  "BAN_USER",
  "STOP_AUCTION_AND_BAN",
]);

export interface AdminAuctionReportItem extends AuctionReportItem {
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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminAuctionReportsResponse>
) {
  const adminUserId = req.session.user?.id;
  const isAdmin = await hasAdminAccess(adminUserId);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다.", reports: [], counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 } });
  }

  if (req.method === "GET") {
    const statusFilter = String(req.query.status || "ALL");
    const allReports = (await readAuctionReports()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const reports =
      statusFilter === "ALL"
        ? allReports
        : allReports.filter((report) => report.status === statusFilter);

    const auctionIds = Array.from(new Set(reports.map((report) => report.auctionId)));
    const userIds = Array.from(
      new Set(
        reports.flatMap((report) => [report.reporterId, report.reportedUserId])
      )
    );

    const [auctions, users] = await Promise.all([
      auctionIds.length
        ? client.auction.findMany({
            where: { id: { in: auctionIds } },
            select: { id: true, title: true, status: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? client.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const auctionById = new Map(auctions.map((auction) => [auction.id, auction]));
    const userById = new Map(users.map((user) => [user.id, user]));

    const enrichedReports: AdminAuctionReportItem[] = reports.map((report) => ({
      ...report,
      auction: auctionById.get(report.auctionId),
      reporter: userById.get(report.reporterId),
      reportedUser: userById.get(report.reportedUserId),
    }));

    const counts = allReports.reduce<Record<AuctionReportStatus, number>>(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { OPEN: 0, RESOLVED: 0, REJECTED: 0 }
    );

    return res.json({
      success: true,
      reports: enrichedReports,
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
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
      });
    }

    if (!REPORT_STATUS.has(parsedDecision) || parsedDecision === "OPEN") {
      return res.status(400).json({
        success: false,
        error: "처리 상태는 RESOLVED 또는 REJECTED만 가능합니다.",
        reports: [],
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
      });
    }

    if (!REPORT_ACTION.has(parsedAction)) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 처리 액션입니다.",
        reports: [],
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
      });
    }

    if (parsedDecision === "REJECTED" && parsedAction !== "NONE") {
      return res.status(400).json({
        success: false,
        error: "신고 기각(REJECTED) 처리에서는 제재 액션을 함께 사용할 수 없습니다.",
        reports: [],
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
      });
    }

    const reports = await readAuctionReports();
    const target = reports.find((report) => report.id === parsedReportId);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "신고를 찾을 수 없습니다.",
        reports: [],
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
      });
    }

    if (target.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        error: "이미 처리된 신고입니다.",
        reports: [],
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
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

    const next = await updateAuctionReport(parsedReportId, {
      status: parsedDecision,
      resolutionAction: parsedAction,
      resolutionNote: parsedNote || null,
      resolvedBy: adminUserId || null,
      resolvedAt: new Date().toISOString(),
    });

    if (!next) {
      return res.status(500).json({
        success: false,
        error: "신고 상태 업데이트에 실패했습니다.",
        reports: [],
        counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
      });
    }

    const [auctions, users] = await Promise.all([
      client.auction.findMany({
        where: { id: { in: [next.auctionId] } },
        select: { id: true, title: true, status: true },
      }),
      client.user.findMany({
        where: { id: { in: [next.reporterId, next.reportedUserId] } },
        select: { id: true, name: true, status: true },
      }),
    ]);

    const auctionById = new Map(auctions.map((auction) => [auction.id, auction]));
    const userById = new Map(users.map((user) => [user.id, user]));

    return res.json({
      success: true,
      reports: [
        {
          ...next,
          auction: auctionById.get(next.auctionId),
          reporter: userById.get(next.reporterId),
          reportedUser: userById.get(next.reportedUserId),
        },
      ],
      counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
    });
  }

  return res.status(405).json({
    success: false,
    error: "지원하지 않는 메서드입니다.",
    reports: [],
    counts: { OPEN: 0, RESOLVED: 0, REJECTED: 0 },
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
