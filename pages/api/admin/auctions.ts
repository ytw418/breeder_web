import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { hasAdminAccess } from "./_utils";
import { Auction, Bid, User } from "@prisma/client";
import { createNotification } from "@libs/server/notification";

export interface AdminAuctionItem extends Auction {
  user: Pick<User, "id" | "name" | "email">;
  bids: (Bid & { user: Pick<User, "id" | "name"> })[];
  _count: { bids: number };
}

export interface AdminAuctionsResponse {
  success: boolean;
  auctions: AdminAuctionItem[];
  totalCount: number;
  totalPages: number;
  summary: {
    total: number;
    active: number;
    ended: number;
    failed: number;
    cancelled: number;
  };
  error?: string;
}

const ALLOWED_STATUS = new Set(["진행중", "종료", "유찰", "취소"]);

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    session: { user },
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const { page = 1, limit = 20, keyword = "", status = "전체" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (String(status) !== "전체") where.status = String(status);
    if (String(keyword).trim()) {
      where.OR = [
        { title: { contains: String(keyword).trim() } },
        { description: { contains: String(keyword).trim() } },
        { user: { name: { contains: String(keyword).trim() } } },
      ];
    }

    const [auctions, totalCount, total, active, ended, failed, cancelled] = await Promise.all([
      client.auction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          bids: {
            orderBy: { amount: "desc" },
            take: 1,
            include: { user: { select: { id: true, name: true } } },
          },
          _count: { select: { bids: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip,
      }),
      client.auction.count({ where }),
      client.auction.count(),
      client.auction.count({ where: { status: "진행중" } }),
      client.auction.count({ where: { status: "종료" } }),
      client.auction.count({ where: { status: "유찰" } }),
      client.auction.count({ where: { status: "취소" } }),
    ]);

    return res.json({
      success: true,
      auctions,
      totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
      summary: { total, active, ended, failed, cancelled },
    });
  }

  if (req.method === "POST") {
    const { action, id, status } = req.body || {};
    if (action !== "update_status") {
      return res.status(400).json({ success: false, error: "유효하지 않은 액션입니다." });
    }

    const auctionId = Number(id);
    if (Number.isNaN(auctionId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 경매 ID입니다." });
    }
    if (!ALLOWED_STATUS.has(String(status))) {
      return res.status(400).json({ success: false, error: "유효하지 않은 상태값입니다." });
    }

    const auction = await client.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
      },
    });
    if (!auction) {
      return res.status(404).json({ success: false, error: "경매를 찾을 수 없습니다." });
    }

    const nextStatus = String(status);
    const topBid = auction.bids[0];
    const winnerId = nextStatus === "종료" ? topBid?.userId ?? null : null;

    await client.auction.update({
      where: { id: auctionId },
      data: {
        status: nextStatus,
        winnerId,
      },
    });

    if (nextStatus === "종료" && topBid) {
      await Promise.all([
        createNotification({
          type: "AUCTION_WON",
          userId: topBid.userId,
          senderId: auction.userId,
          message: `"${auction.title}" 경매에 낙찰되었습니다. 낙찰가 ${topBid.amount.toLocaleString()}원입니다.`,
          targetId: auctionId,
          targetType: "auction",
          dedupe: true,
        }),
        createNotification({
          type: "AUCTION_END",
          userId: auction.userId,
          senderId: topBid.userId,
          message: `"${auction.title}" 경매가 종료되었습니다. 낙찰자 ID ${topBid.userId}, 낙찰가 ${topBid.amount.toLocaleString()}원입니다.`,
          targetId: auctionId,
          targetType: "auction",
          dedupe: true,
        }),
      ]);
    }

    if (nextStatus === "유찰" || nextStatus === "취소") {
      await createNotification({
        type: "AUCTION_END",
        userId: auction.userId,
        senderId: auction.userId,
        message:
          nextStatus === "유찰"
            ? `"${auction.title}" 경매가 유찰로 종료되었습니다.`
            : `"${auction.title}" 경매가 관리자에 의해 취소되었습니다.`,
        targetId: auctionId,
        targetType: "auction",
        allowSelf: true,
        dedupe: true,
      });
    }

    return res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
