import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";
import { getAuctionRanking, getBloodlineRanking, getBreederRanking } from "@libs/server/ranking";
import { getKstWeekWindow } from "@libs/server/season";

const pickTopSellerIds = (items: Awaited<ReturnType<typeof getAuctionRanking>>) => {
  return items.slice(0, 3).map((item, index) => ({
    userId: item.seller.id,
    entityId: item.auctionId,
    rank: index + 1,
    label: `주간 최고가 경매 ${index + 1}위`,
  }));
};

export const finalizeClosedWeeklySeasons = async () => {
  const now = new Date();
  const targetSeasons = await client.season.findMany({
    where: {
      kind: "WEEKLY",
      status: "ACTIVE",
      endAt: { lt: now },
    },
    orderBy: { endAt: "desc" },
  });

  for (const season of targetSeasons) {
    const existingBadges = await client.userBadge.count({
      where: { seasonId: season.id },
    });
    if (existingBadges === 0) {
      const [breeders, bloodlines, auctions] = await Promise.all([
        getBreederRanking({ limit: 3, baseDate: season.endAt }),
        getBloodlineRanking({ limit: 3, baseDate: season.endAt }),
        getAuctionRanking({ limit: 3, periodScope: "week", baseDate: season.endAt }),
      ]);

      await client.userBadge.createMany({
        data: [
          ...breeders.map((item) => ({
            userId: item.user.id,
            seasonId: season.id,
            badgeType: "TOP_BREEDER" as const,
            rank: item.rank,
            entityType: "USER" as const,
            entityId: item.user.id,
            label: `주간 TOP 브리더 ${item.rank}위`,
          })),
          ...bloodlines.map((item) => ({
            userId: item.creator.id,
            seasonId: season.id,
            badgeType: "TOP_BLOODLINE" as const,
            rank: item.rank,
            entityType: "BLOODLINE" as const,
            entityId: item.bloodlineRootId,
            label: `주간 인기 혈통 ${item.rank}위`,
          })),
          ...pickTopSellerIds(auctions).map((item) => ({
            userId: item.userId,
            seasonId: season.id,
            badgeType: "HIGHEST_AUCTION_SELLER" as const,
            rank: item.rank,
            entityType: "AUCTION" as const,
            entityId: item.entityId,
            label: item.label,
          })),
        ],
      });
    }

    await client.season.update({
      where: { id: season.id },
      data: { status: "CLOSED" },
    });
  }

  const currentWindow = getKstWeekWindow(now);
  await client.season.upsert({
    where: {
      kind_startAt_endAt: {
        kind: "WEEKLY",
        startAt: currentWindow.startAt,
        endAt: currentWindow.endAt,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      kind: "WEEKLY",
      startAt: currentWindow.startAt,
      endAt: currentWindow.endAt,
      status: "ACTIVE",
    },
  });
};

export const processRankingAlerts = async () => {
  const [subscriptions, breederRanking, bloodlineRanking, auctionRanking] = await Promise.all([
    client.alertSubscription.findMany({
      where: { enabled: true },
      include: { state: true },
    }),
    getBreederRanking({ limit: 50 }),
    getBloodlineRanking({ limit: 50 }),
    getAuctionRanking({ periodScope: "week", limit: 20 }),
  ]);

  const breederMap = new Map(breederRanking.map((item) => [item.user.id, item]));
  const bloodlineMap = new Map(bloodlineRanking.map((item) => [item.bloodlineRootId, item]));

  for (const subscription of subscriptions) {
    if (subscription.entityType === "USER") {
      const current = breederMap.get(subscription.entityId);
      const previousRank = subscription.state?.lastObservedRank ?? null;
      const currentRank = current?.rank ?? null;
      const currentScore = current?.score ?? null;

      if (
        subscription.alertType === "BREEDER_RANK_DROP" &&
        previousRank &&
        currentRank &&
        currentRank > previousRank
      ) {
        await createNotification({
          type: "BREEDER_RANK_DROP",
          userId: subscription.userId,
          senderId: subscription.userId,
          message: `이번 주 브리더 순위가 #${previousRank}에서 #${currentRank}로 하락했습니다.`,
          targetId: subscription.entityId,
          targetType: "user",
          allowSelf: true,
        });
      }

      if (
        subscription.alertType === "BREEDER_OVERTAKEN" &&
        previousRank &&
        currentRank &&
        currentRank > previousRank
      ) {
        await createNotification({
          type: "BREEDER_OVERTAKEN",
          userId: subscription.userId,
          senderId: subscription.userId,
          message: `다른 브리더에게 추월당했습니다. 현재 순위는 #${currentRank}입니다.`,
          targetId: subscription.entityId,
          targetType: "user",
          allowSelf: true,
        });
      }

      await client.alertState.upsert({
        where: { subscriptionId: subscription.id },
        update: {
          lastObservedRank: currentRank,
          lastObservedValue: currentScore,
          lastNotifiedAt: new Date(),
        },
        create: {
          subscriptionId: subscription.id,
          lastObservedRank: currentRank,
          lastObservedValue: currentScore,
          lastNotifiedAt: new Date(),
        },
      });
      continue;
    }

    if (subscription.entityType === "BLOODLINE") {
      const current = bloodlineMap.get(subscription.entityId);
      const previousRank = subscription.state?.lastObservedRank ?? null;
      const currentRank = current?.rank ?? null;
      const currentScore = current?.score ?? null;

      if (
        subscription.alertType === "BLOODLINE_OVERTAKEN" &&
        previousRank &&
        currentRank &&
        currentRank > previousRank
      ) {
        await createNotification({
          type: "BLOODLINE_OVERTAKEN",
          userId: subscription.userId,
          senderId: subscription.userId,
          message: `"${current?.name || "혈통"}" 순위가 내려갔습니다. 현재 #${currentRank}입니다.`,
          targetId: subscription.entityId,
          targetType: "user",
          allowSelf: true,
        });
      }

      await client.alertState.upsert({
        where: { subscriptionId: subscription.id },
        update: {
          lastObservedRank: currentRank,
          lastObservedValue: currentScore,
          lastNotifiedAt: new Date(),
        },
        create: {
          subscriptionId: subscription.id,
          lastObservedRank: currentRank,
          lastObservedValue: currentScore,
          lastNotifiedAt: new Date(),
        },
      });
      continue;
    }

    if (subscription.entityType === "AUCTION" && subscription.alertType === "AUCTION_RECORD_BROKEN") {
      const sourceAuction = await client.auction.findUnique({
        where: { id: subscription.entityId },
        select: { category: true, currentPrice: true, userId: true },
      });
      if (!sourceAuction?.category) continue;

      const categoryTop = auctionRanking.find(
        (item) => item.topLevelCategory === sourceAuction.category || item.category === sourceAuction.category
      ); 

      if (categoryTop && categoryTop.auctionId !== subscription.entityId) {
        await createNotification({
          type: "AUCTION_RECORD_BROKEN",
          userId: subscription.userId,
          senderId: sourceAuction.userId,
          message: `${sourceAuction.category} 카테고리 최고가 기록이 ${categoryTop.currentPrice.toLocaleString()}원으로 갱신되었습니다.`,
          targetId: categoryTop.auctionId,
          targetType: "auction",
          allowSelf: true,
        });
      }

      await client.alertState.upsert({
        where: { subscriptionId: subscription.id },
        update: {
          lastObservedRank: categoryTop?.rank ?? null,
          lastObservedValue: categoryTop?.currentPrice ?? null,
          lastNotifiedAt: new Date(),
        },
        create: {
          subscriptionId: subscription.id,
          lastObservedRank: categoryTop?.rank ?? null,
          lastObservedValue: categoryTop?.currentPrice ?? null,
          lastNotifiedAt: new Date(),
        },
      });
    }
  }
};
