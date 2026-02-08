import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Auction, Bid, User } from "@prisma/client";

/** 경매 상세 응답 타입 */
export interface AuctionDetailResponse {
  success: boolean;
  error?: string;
  auction?: Auction & {
    user: Pick<User, "id" | "name" | "avatar">;
    bids: (Bid & { user: Pick<User, "id" | "name" | "avatar"> })[];
    _count: { bids: number };
  };
  isOwner?: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id },
    session: { user },
  } = req;

  const auctionId = Number(id);
  if (isNaN(auctionId)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 경매 ID입니다." });
  }

  // 종료 시간이 지났으면 자동 종료 처리
  const rawAuction = await client.auction.findUnique({ where: { id: auctionId } });
  if (rawAuction && rawAuction.status === "진행중" && new Date(rawAuction.endAt) <= new Date()) {
    // 최고 입찰자를 낙찰자로 설정
    const topBid = await client.bid.findFirst({
      where: { auctionId },
      orderBy: { amount: "desc" },
    });
    await client.auction.update({
      where: { id: auctionId },
      data: {
        status: topBid ? "종료" : "유찰",
        winnerId: topBid?.userId || null,
      },
    });
  }

  const auction = await client.auction.findUnique({
    where: { id: auctionId },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      bids: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { amount: "desc" },
        take: 20,
      },
      _count: { select: { bids: true } },
    },
  });

  if (!auction) {
    return res.status(404).json({ success: false, error: "경매를 찾을 수 없습니다." });
  }

  return res.json({
    success: true,
    auction,
    isOwner: user?.id === auction.userId,
  });
}

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: false })
);
