import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";

/** 입찰 응답 타입 */
export interface BidResponse {
  success: boolean;
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id },
    session: { user },
    body: { amount },
  } = req;

  if (!user?.id) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }

  const auctionId = Number(id);
  const bidAmount = Number(amount);

  if (isNaN(auctionId) || isNaN(bidAmount)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 요청입니다." });
  }

  try {
    const auction = await client.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: { orderBy: { amount: "desc" }, take: 1 },
      },
    });

    if (!auction) {
      return res.status(404).json({ success: false, error: "경매를 찾을 수 없습니다." });
    }

    // 종료 확인
    if (auction.status !== "진행중" || new Date(auction.endAt) <= new Date()) {
      return res.status(400).json({ success: false, error: "이미 종료된 경매입니다." });
    }

    // 본인 경매 입찰 불가
    if (auction.userId === user.id) {
      return res.status(400).json({ success: false, error: "본인 경매에는 입찰할 수 없습니다." });
    }

    // 최소 입찰가 확인
    const minimumBid = auction.currentPrice + auction.minBidIncrement;
    if (bidAmount < minimumBid) {
      return res.status(400).json({
        success: false,
        error: `최소 ${minimumBid.toLocaleString()}원 이상 입찰해야 합니다.`,
      });
    }

    // 이전 최고 입찰자 정보
    const previousTopBidder = auction.bids[0];

    // 입찰 생성 + 경매 현재가 업데이트 (트랜잭션)
    await client.$transaction([
      client.bid.create({
        data: {
          amount: bidAmount,
          user: { connect: { id: user.id } },
          auction: { connect: { id: auctionId } },
        },
      }),
      client.auction.update({
        where: { id: auctionId },
        data: { currentPrice: bidAmount },
      }),
    ]);

    // 알림 전송
    const bidder = await client.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    // 경매 등록자에게 알림
    if (bidder) {
      createNotification({
        type: "BID",
        userId: auction.userId,
        senderId: user.id,
        message: `${bidder.name}님이 "${auction.title}" 경매에 ${bidAmount.toLocaleString()}원을 입찰했습니다.`,
        targetId: auctionId,
        targetType: "auction",
      });
    }

    // 이전 최고 입찰자에게 알림 (본인이 아닌 경우)
    if (previousTopBidder && previousTopBidder.userId !== user.id && bidder) {
      createNotification({
        type: "OUTBID",
        userId: previousTopBidder.userId,
        senderId: user.id,
        message: `"${auction.title}" 경매에서 더 높은 입찰(${bidAmount.toLocaleString()}원)이 들어왔습니다.`,
        targetId: auctionId,
        targetType: "auction",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Bid error:", error);
    return res.status(500).json({ success: false, error: "입찰 처리 중 오류가 발생했습니다." });
  }
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
