import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";

export const settleExpiredAuctions = async (targetAuctionId?: number) => {
  const now = new Date();
  const where: { status: string; endAt: { lte: Date }; id?: number } = {
    status: "진행중",
    endAt: { lte: now },
  };
  if (targetAuctionId) {
    where.id = targetAuctionId;
  }

  const expiredAuctions = await client.auction.findMany({
    where,
    select: {
      id: true,
      title: true,
      userId: true,
    },
  });

  if (!expiredAuctions.length) return 0;

  let settledCount = 0;

  for (const auction of expiredAuctions) {
    const topBid = await client.bid.findFirst({
      where: { auctionId: auction.id },
      orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
      select: {
        amount: true,
        userId: true,
        user: { select: { name: true } },
      },
    });

    const nextStatus = topBid ? "종료" : "유찰";

    const updated = await client.auction.updateMany({
      where: {
        id: auction.id,
        status: "진행중",
      },
      data: {
        status: nextStatus,
        winnerId: topBid?.userId || null,
      },
    });

    if (!updated.count) continue;

    settledCount += 1;

    if (topBid) {
      await Promise.all([
        createNotification({
          type: "AUCTION_WON",
          userId: topBid.userId,
          senderId: auction.userId,
          message: `"${auction.title}" 경매에 낙찰되었습니다. 낙찰가 ${topBid.amount.toLocaleString()}원입니다.`,
          targetId: auction.id,
          targetType: "auction",
          dedupe: true,
        }),
        createNotification({
          type: "AUCTION_END",
          userId: auction.userId,
          senderId: topBid.userId,
          message: `"${auction.title}" 경매가 종료되었습니다. 낙찰자 ${topBid.user.name}, 낙찰가 ${topBid.amount.toLocaleString()}원입니다.`,
          targetId: auction.id,
          targetType: "auction",
          dedupe: true,
        }),
      ]);
      continue;
    }

    await createNotification({
      type: "AUCTION_END",
      userId: auction.userId,
      senderId: auction.userId,
      message: `"${auction.title}" 경매가 유찰로 종료되었습니다.`,
      targetId: auction.id,
      targetType: "auction",
      allowSelf: true,
      dedupe: true,
    });
  }

  return settledCount;
};
