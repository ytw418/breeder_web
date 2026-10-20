import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";
import { getAuctionRanking, getBloodlineRanking, getBreederRanking } from "@libs/server/ranking";
import { getKstWeekWindow } from "@libs/server/season";

type RankChangeInput = {
  previousRank: number | null;
  currentRank: number | null;
  observedAt: Date | null | undefined;
  weekStart: Date;
  notifiedThisWeek: boolean;
};

/**
 * 순위 상승(RANK_UP, 앱 docs/prd/community-vibe.md §5b)·하락(BREEDER_RANK_DROP, 앱 docs/prd/notifications.md AC-13) 알림 조건.
 * 지난 관측(AlertState)이 이번 주(KST) 안이고 순위가 그 방향으로 바뀌었으며, 이번 주에 아직 같은 알림을 보내지 않았을 때만.
 * 랭킹은 주간 집계라 주가 바뀌면 점수가 0 에서 다시 시작해 순위가 크게 흔들리므로 지난주 관측과는 비교하지 않는다.
 */
export const shouldNotifyRankChange = ({
  direction,
  previousRank,
  currentRank,
  observedAt,
  weekStart,
  notifiedThisWeek,
}: RankChangeInput & { direction: "up" | "down" }) =>
  previousRank !== null &&
  currentRank !== null &&
  (direction === "up" ? currentRank < previousRank : currentRank > previousRank) &&
  !!observedAt &&
  observedAt.getTime() >= weekStart.getTime() &&
  !notifiedThisWeek;

export const shouldNotifyRankUp = (input: RankChangeInput) => shouldNotifyRankChange({ ...input, direction: "up" });

export const rankUpMessage = (previousRank: number, currentRank: number) =>
  `순위가 올랐어요 · ${previousRank}위 → ${currentRank}위`;

/** 순위 하락 알림 한 통(BREEDER_RANK_DROP). 추월은 같은 일이라 따로 보내지 않고 인원만 붙인다. */
export const rankDropMessage = (previousRank: number, currentRank: number) =>
  `순위가 #${previousRank}에서 #${currentRank}로 내려갔어요 · 추월한 브리더 ${currentRank - previousRank}명`;

const pickTopSellerIds = (items: Awaited<ReturnType<typeof getAuctionRanking>>) => {
  return items.slice(0, 3).map((item, index) => ({
    userId: item.seller.id,
    entityId: item.auctionId,
    rank: index + 1,
    label: `주간 최고가 경매 ${index + 1}위`,
  }));
};

const updateAlertState = async ({
  subscriptionId,
  lastObservedRank,
  lastObservedValue,
  notified,
  previousNotifiedAt,
}: {
  subscriptionId: number;
  lastObservedRank: number | null;
  lastObservedValue: number | null;
  notified: boolean;
  previousNotifiedAt?: Date | null;
}) => {
  return client.alertState.upsert({
    where: { subscriptionId },
    update: {
      lastObservedRank,
      lastObservedValue,
      lastNotifiedAt: notified ? new Date() : previousNotifiedAt ?? null,
    },
    create: {
      subscriptionId,
      lastObservedRank,
      lastObservedValue,
      lastNotifiedAt: notified ? new Date() : previousNotifiedAt ?? null,
    },
  });
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
  const weekStart = getKstWeekWindow().startAt;
  const sentThisWeek = async (userId: number, type: "RANK_UP" | "BREEDER_RANK_DROP") =>
    !!(await client.notification.findFirst({
      where: { userId, type, createdAt: { gte: weekStart } },
      select: { id: true },
    }));

  for (const subscription of subscriptions) {
    if (subscription.entityType === "USER") {
      const current = breederMap.get(subscription.entityId);
      const previousRank = subscription.state?.lastObservedRank ?? null;
      const currentRank = current?.rank ?? null;
      const currentScore = current?.score ?? null;
      const observedAt = subscription.state?.updatedAt;
      let notified = false;

      // 순위 하락은 주 1회 한 통. 같은 하락에 '추월' 알림(BREEDER_OVERTAKEN)을 따로 보내지 않는다. 누르면 전체 랭킹의 내 행으로 간다.
      if (subscription.alertType === "BREEDER_RANK_DROP" && previousRank && currentRank && currentRank > previousRank) {
        if (
          shouldNotifyRankChange({
            direction: "down",
            previousRank,
            currentRank,
            observedAt,
            weekStart,
            notifiedThisWeek: await sentThisWeek(subscription.userId, "BREEDER_RANK_DROP"),
          })
        ) {
          await createNotification({
            type: "BREEDER_RANK_DROP",
            userId: subscription.userId,
            senderId: subscription.userId,
            message: rankDropMessage(previousRank, currentRank),
            targetId: subscription.userId,
            targetType: "ranking",
            allowSelf: true,
          });
          notified = true;
        }
      }

      // 순위 상승은 사용자당 구독 하나(BREEDER_RANK_DROP)에서만 판단해 두 번 보내지 않는다.
      if (subscription.alertType === "BREEDER_RANK_DROP" && previousRank && currentRank && currentRank < previousRank) {
        if (
          shouldNotifyRankUp({
            previousRank,
            currentRank,
            observedAt,
            weekStart,
            notifiedThisWeek: await sentThisWeek(subscription.userId, "RANK_UP"),
          })
        ) {
          await createNotification({
            type: "RANK_UP",
            userId: subscription.userId,
            senderId: subscription.userId,
            message: rankUpMessage(previousRank, currentRank),
            targetId: subscription.entityId,
            targetType: "ranking",
            allowSelf: true,
          });
          notified = true;
        }
      }

      await updateAlertState({
        subscriptionId: subscription.id,
        lastObservedRank: currentRank,
        lastObservedValue: currentScore,
        notified,
        previousNotifiedAt: subscription.state?.lastNotifiedAt,
      });
      continue;
    }

    if (subscription.entityType === "BLOODLINE") {
      const current = bloodlineMap.get(subscription.entityId);
      const previousRank = subscription.state?.lastObservedRank ?? null;
      const currentRank = current?.rank ?? null;
      const currentScore = current?.score ?? null;
      let notified = false;

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
          targetType: "bloodline",
          allowSelf: true,
        });
        notified = true;
      }

      await updateAlertState({
        subscriptionId: subscription.id,
        lastObservedRank: currentRank,
        lastObservedValue: currentScore,
        notified,
        previousNotifiedAt: subscription.state?.lastNotifiedAt,
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
      const previousTopAuctionId = subscription.state?.lastObservedValue ?? null;
      const currentTopAuctionId = categoryTop?.auctionId ?? null;
      const notified = categoryTop
        ? categoryTop.auctionId !== subscription.entityId &&
          currentTopAuctionId !== previousTopAuctionId
        : false;

      if (notified && categoryTop) {
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

      await updateAlertState({
        subscriptionId: subscription.id,
        lastObservedRank: categoryTop?.rank ?? null,
        lastObservedValue: currentTopAuctionId,
        notified,
        previousNotifiedAt: subscription.state?.lastNotifiedAt,
      });
    }
  }
};
