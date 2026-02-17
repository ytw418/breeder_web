import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";
import {
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  isBidAmountValid,
  getBidIncrement,
} from "@libs/auctionRules";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { extractAuctionIdFromPath } from "@libs/auction-route";

/** 입찰 응답 타입 */
export interface BidResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  extended?: boolean;
  endAt?: string;
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
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      errorCode: "BID_AUTH_REQUIRED",
    });
  }

  const auctionId = extractAuctionIdFromPath(id);
  const bidAmount = Number(amount);

  if (isNaN(auctionId) || isNaN(bidAmount)) {
    return res.status(400).json({
      success: false,
      error: "유효하지 않은 요청입니다.",
      errorCode: "BID_INVALID_REQUEST",
    });
  }

  try {
    await settleExpiredAuctions(auctionId);

    const bidderAccount = await client.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true, status: true },
    });
    if (!bidderAccount || bidderAccount.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "현재 계정 상태에서는 입찰이 제한됩니다.",
        errorCode: "BID_ACCOUNT_RESTRICTED",
      });
    }

    const auction = await client.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: { orderBy: { amount: "desc" }, take: 1 },
      },
    });

    if (!auction) {
      return res.status(404).json({
        success: false,
        error: "경매를 찾을 수 없습니다.",
        errorCode: "BID_AUCTION_NOT_FOUND",
      });
    }

    // 종료 확인
    if (auction.status !== "진행중" || new Date(auction.endAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: "이미 종료된 경매입니다.",
        errorCode: "BID_AUCTION_CLOSED",
      });
    }

    // 본인 경매 입찰 불가
    if (auction.userId === user.id) {
      return res.status(400).json({
        success: false,
        error: "본인 경매에는 입찰할 수 없습니다.",
        errorCode: "BID_SELF_NOT_ALLOWED",
      });
    }

    const previousTopBidder = auction.bids[0];
    if (previousTopBidder?.userId === user.id) {
      return res.status(400).json({
        success: false,
        error: "현재 최고 입찰자는 다시 입찰할 수 없습니다.",
        errorCode: "BID_TOP_BIDDER_CANNOT_REBID",
      });
    }

    // 최소 입찰가 확인
    const minBidIncrement = getBidIncrement(auction.currentPrice);
    const minimumBid = auction.currentPrice + minBidIncrement;
    if (!Number.isInteger(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "입찰 금액은 1원 이상의 정수여야 합니다.",
        errorCode: "BID_AMOUNT_NOT_INTEGER",
      });
    }

    if (!isBidAmountValid({ currentPrice: auction.currentPrice, bidAmount })) {
      return res.status(400).json({
        success: false,
        error: `입찰 금액은 최소 ${minimumBid.toLocaleString()}원 이상이며 ${minBidIncrement.toLocaleString()}원 단위여야 합니다.`,
        errorCode: "BID_AMOUNT_RULE_VIOLATION",
      });
    }

    const now = Date.now();
    const endTime = new Date(auction.endAt).getTime();
    const shouldExtend = endTime - now <= AUCTION_EXTENSION_WINDOW_MS;
    const nextEndAt = shouldExtend
      ? new Date(endTime + AUCTION_EXTENSION_MS)
      : new Date(endTime);

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
        data: {
          currentPrice: bidAmount,
          minBidIncrement: getBidIncrement(bidAmount),
          endAt: nextEndAt,
        },
      }),
    ]);

    // 알림 전송
    const bidder = await client.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    // 경매 등록자에게 알림
    if (bidder) {
      await createNotification({
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
      await createNotification({
        type: "OUTBID",
        userId: previousTopBidder.userId,
        senderId: user.id,
        message: `"${auction.title}" 경매에서 더 높은 입찰(${bidAmount.toLocaleString()}원)이 들어왔습니다.`,
        targetId: auctionId,
        targetType: "auction",
      });
    }

    return res.json({ success: true, extended: shouldExtend, endAt: nextEndAt.toISOString() });
  } catch (error) {
    console.error("Bid error:", error);
    return res.status(500).json({
      success: false,
      error: "입찰 처리 중 오류가 발생했습니다.",
      errorCode: "BID_PROCESS_FAILED",
    });
  }
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
