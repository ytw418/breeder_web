import client from "@libs/server/client";
import { MissionProgressItem } from "@libs/shared/ranking";
import { getKstWeekWindow } from "@libs/server/season";

const DEFAULT_MISSIONS = [
  { key: "post_create", title: "게시글 1개 작성", targetCount: 1, rewardLabel: "랭킹 참여 시작" },
  { key: "comment_write", title: "댓글 3개 작성", targetCount: 3, rewardLabel: "참여 배지 후보" },
  { key: "auction_bid", title: "입찰 1회 참여", targetCount: 1, rewardLabel: "경매 랭킹 참여" },
] as const;

export const ensureCurrentWeeklySeason = async (baseDate = new Date()) => {
  // 시즌 엔트리가 비어 있어도 홈/랭킹 API가 바로 동작하도록 조회 시점에 현재 주간 시즌을 보정한다.
  const { startAt, endAt } = getKstWeekWindow(baseDate);

  await client.season.updateMany({
    where: {
      kind: "WEEKLY",
      status: "ACTIVE",
      endAt: { lt: baseDate },
    },
    data: {
      status: "CLOSED",
    },
  });

  const existing = await client.season.findFirst({
    where: {
      kind: "WEEKLY",
      startAt,
      endAt,
    },
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      return client.season.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
    }
    return existing;
  }

  return client.season.create({
    data: {
      kind: "WEEKLY",
      startAt,
      endAt,
      status: "ACTIVE",
    },
  });
};

export const ensureDefaultMissionTemplates = async () => {
  // 초기 미션은 운영자가 별도 시드하지 않아도 기본 세트를 자동 보장한다.
  await Promise.all(
    DEFAULT_MISSIONS.map((mission) =>
      client.missionTemplate.upsert({
        where: { key: mission.key },
        update: {
          title: mission.title,
          targetCount: mission.targetCount,
          rewardLabel: mission.rewardLabel,
          isActive: true,
        },
        create: {
          ...mission,
          isActive: true,
        },
      })
    )
  );
};

export const getMissionTemplates = async () => {
  await ensureDefaultMissionTemplates();
  return client.missionTemplate.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
};

export const getUserMissionSummary = async (userId: number): Promise<MissionProgressItem[]> => {
  // 홈 개인화 섹션은 시즌과 템플릿이 없는 상태에서도 빈 껍데기가 아니라 진행도를 바로 내려준다.
  const [season, templates] = await Promise.all([
    ensureCurrentWeeklySeason(),
    getMissionTemplates(),
  ]);

  const progressRows = await client.userMissionProgress.findMany({
    where: {
      userId,
      seasonId: season.id,
    },
  });

  const progressMap = new Map(progressRows.map((row) => [row.missionKey, row]));

  return templates.map((template) => {
    const row = progressMap.get(template.key);
    const progress = row?.progress ?? 0;
    return {
      key: template.key,
      title: template.title,
      rewardLabel: template.rewardLabel ?? null,
      targetCount: template.targetCount,
      progress,
      isCompleted: Boolean(row?.completedAt) || progress >= template.targetCount,
      completedAt: row?.completedAt?.toISOString() ?? null,
    };
  });
};

export const incrementUserMissionProgress = async (
  userId: number,
  missionKey: string,
  amount = 1
) => {
  // 게시글/댓글/입찰 API에서 공통으로 호출하므로 존재하지 않는 미션 키는 조용히 무시한다.
  const [season, templates] = await Promise.all([
    ensureCurrentWeeklySeason(),
    getMissionTemplates(),
  ]);
  const template = templates.find((item) => item.key === missionKey);
  if (!template) return null;

  const existing = await client.userMissionProgress.findUnique({
    where: {
      userId_seasonId_missionKey: {
        userId,
        seasonId: season.id,
        missionKey,
      },
    },
  });

  const nextProgress = Math.min((existing?.progress ?? 0) + amount, template.targetCount);
  const completedAt =
    nextProgress >= template.targetCount
      ? existing?.completedAt ?? new Date()
      : null;

  return client.userMissionProgress.upsert({
    where: {
      userId_seasonId_missionKey: {
        userId,
        seasonId: season.id,
        missionKey,
      },
    },
    update: {
      progress: nextProgress,
      completedAt,
    },
    create: {
      userId,
      seasonId: season.id,
      missionKey,
      progress: nextProgress,
      completedAt,
    },
  });
};

export const ensureAlertSubscription = async ({
  userId,
  alertType,
  entityType,
  entityId,
}: {
  userId: number;
  alertType: "BREEDER_RANK_DROP" | "BREEDER_OVERTAKEN" | "BLOODLINE_OVERTAKEN" | "AUCTION_RECORD_BROKEN";
  entityType: "USER" | "BLOODLINE" | "AUCTION";
  entityId: number;
}) => {
  // 홈 노출만으로도 기본 FOMO 알림 구독이 누락되지 않게 upsert로 묶었다.
  return client.alertSubscription.upsert({
    where: {
      userId_alertType_entityType_entityId: {
        userId,
        alertType,
        entityType,
        entityId,
      },
    },
    update: {
      enabled: true,
    },
    create: {
      userId,
      alertType,
      entityType,
      entityId,
      enabled: true,
    },
  });
};
