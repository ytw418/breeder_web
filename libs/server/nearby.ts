import client from "@libs/server/client";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import { getTopSpeciesByUserIds } from "@libs/server/profileSpecies";
import { getKstWeekWindow } from "@libs/server/season";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import type {
  NearbyBreederItem as ContractNearbyBreederItem,
  NearbyBreedersResult as ContractNearbyBreedersResult,
} from "@libs/shared/communityVibe";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import type { Region } from "@libs/shared/regions";
import { nearbyRegions, regionScopeLabel, regionScopeOr, type ScopedRegion } from "@libs/shared/regionScope";

/**
 * 동네 브리더 조회(앱 docs/prd/community-vibe.md §3.6b, §8 `NearbyBreedersResult`).
 * - 범위: 내 시/군/구 중심에서 50km 안 시/군/구 + 같은 특별·광역시 전체(libs/shared/regionScope).
 * - `regionVisible=true` 인 ACTIVE 사용자만. 본인과 차단 관계(양방향)는 뺀다.
 * - 정렬: 같은 시/군/구 → 거리 → 내가 팔로우한 사람 → 최근 활동(마지막 글, 없으면 동네 설정 시각).
 * - 거리·좌표는 시/군/구 중심 좌표로만 계산한다(사용자 좌표 미저장).
 * - 옛 클라이언트(2026-10-09 홈 동네 섹션)가 읽던 `region`·`items[].user/region/postsCount/commentsCount` 도 같이 싣는다.
 */

/** 옛 응답 필드(구 앱·웹 화면 호환). 새 화면은 계약 필드만 쓴다. */
export interface NearbyBreederLegacyFields {
  user: { id: number; name: string; avatar: string | null };
  region: Region;
  postsCount: number;
  commentsCount: number;
  /** 프로필 아바타 테두리용 전체 요약(계약 `breederPrograms` 는 programType 문자열 목록). */
  breederProgramSummaries: BreederProgramSummary[];
}

export type NearbyBreederItem = ContractNearbyBreederItem & NearbyBreederLegacyFields;

export type NearbyBreedersResult = Omit<ContractNearbyBreedersResult, "items"> & {
  items: NearbyBreederItem[];
  /** 조회자의 동네. 미설정이면 null(옛 응답 필드). */
  region: Region | null;
};

export const NEARBY_LIMIT_DEFAULT = 3;
export const NEARBY_LIMIT_MAX = 50;
/** 정렬 전에 DB 에서 읽는 최대 인원. 범위 안 인원이 이보다 많아지면 그때 DB 정렬로 바꾼다. */
const SCAN_LIMIT = 300;

/** 어느 쪽이 차단했든 서로 목록에 보이지 않게 한다(피차단자에게 차단 사실을 드러내지 않는다). */
export async function blockedEitherWay(viewerId: number): Promise<number[]> {
  const rows = await client.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId));
}

/** 조회자의 동네 범위. 동네가 없으면 null. */
export async function getViewerRegionScope(
  viewerId: number
): Promise<{ region: Region; regions: ScopedRegion[]; label: string } | null> {
  const viewer = await client.user.findUnique({
    where: { id: viewerId },
    select: { regionSido: true, regionSigungu: true },
  });
  if (!viewer?.regionSido || !viewer.regionSigungu) return null;
  const region: Region = { sido: viewer.regionSido, sigungu: viewer.regionSigungu };
  return {
    region,
    regions: nearbyRegions(region.sido, region.sigungu),
    label: regionScopeLabel(region.sido, region.sigungu),
  };
}

/** 이번 주(KST 월요일부터) 범위 안 '동네' 주제 글 수. 숨김 글·차단 관계 작성자는 뺀다. */
export async function countWeeklyGreetings(
  regions: ScopedRegion[],
  excludedIds: number[] = [],
  now: Date = new Date()
): Promise<number> {
  if (regions.length === 0) return 0;
  const { startAt } = getKstWeekWindow(now);
  return client.post.count({
    where: {
      category: REGION_POST_CATEGORY,
      isHidden: false,
      createdAt: { gte: startAt },
      OR: regionScopeOr(regions),
      ...(excludedIds.length ? { userId: { notIn: excludedIds } } : {}),
    },
  });
}

export async function getNearbyBreeders({
  viewerId,
  limit = NEARBY_LIMIT_DEFAULT,
  now = new Date(),
}: {
  viewerId: number;
  limit?: number;
  now?: Date;
}): Promise<NearbyBreedersResult> {
  const scope = await getViewerRegionScope(viewerId);
  if (!scope) {
    return { scope: "none", regionLabel: "", total: 0, greetingCount: 0, items: [], region: null };
  }
  const { region, regions, label } = scope;
  const distanceOf = new Map(regions.map((r) => [`${r.sido}|${r.sigungu}`, r.distanceKm]));
  const excludedIds = [viewerId, ...(await blockedEitherWay(viewerId))];
  const where = {
    status: "ACTIVE" as const,
    regionVisible: true,
    id: { notIn: excludedIds },
    OR: regionScopeOr(regions),
  };

  const [users, total, greetingCount] = await Promise.all([
    client.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        avatar: true,
        regionSido: true,
        regionSigungu: true,
        regionUpdatedAt: true,
        _count: {
          select: {
            posts: { where: { isHidden: false } },
            Comments: true,
          },
        },
        breederPrograms: {
          where: { status: "ACTIVE" },
          select: breederProgramSummarySelect,
        },
      },
      take: SCAN_LIMIT,
    }),
    client.user.count({ where }),
    countWeeklyGreetings(regions, excludedIds.slice(1), now),
  ]);

  const ids = users.map((user) => user.id);
  const [follows, lastPosts] = ids.length
    ? await Promise.all([
        client.follow.findMany({
          where: { followerId: viewerId, followingId: { in: ids } },
          select: { followingId: true },
        }),
        client.post.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, isHidden: false },
          _max: { createdAt: true },
        }),
      ])
    : [[], []];
  const followingIds = new Set(follows.map((row) => row.followingId));
  const lastPostAt = new Map(
    (lastPosts as Array<{ userId: number; _max: { createdAt: Date | null } }>).map((row) => [
      row.userId,
      row._max.createdAt?.getTime() ?? 0,
    ])
  );

  const ranked = users
    .map((user) => {
      const sido = user.regionSido ?? "";
      const sigungu = user.regionSigungu ?? "";
      const sameRegion = sido === region.sido && sigungu === region.sigungu;
      return {
        user,
        sameRegion,
        distanceKm: sameRegion ? 0 : distanceOf.get(`${sido}|${sigungu}`) ?? 0,
        isFollowing: followingIds.has(user.id),
        activityAt: Math.max(lastPostAt.get(user.id) ?? 0, user.regionUpdatedAt?.getTime() ?? 0),
      };
    })
    .sort(
      (a, b) =>
        Number(b.sameRegion) - Number(a.sameRegion) ||
        a.distanceKm - b.distanceKm ||
        Number(b.isFollowing) - Number(a.isFollowing) ||
        b.activityAt - a.activityAt ||
        a.user.id - b.user.id
    )
    .slice(0, limit);

  const shownIds = ranked.map((item) => item.user.id);
  const [speciesByUser, badgeRows] = shownIds.length
    ? await Promise.all([
        getTopSpeciesByUserIds(shownIds),
        client.userBadge.findMany({
          where: { userId: { in: shownIds } },
          select: { userId: true, label: true },
          orderBy: [{ createdAt: "desc" }, { rank: "asc" }],
        }),
      ])
    : [new Map<number, string[]>(), []];
  const badgesByUser = new Map<number, string[]>();
  for (const row of badgeRows) {
    const list = badgesByUser.get(row.userId) ?? [];
    if (list.length < 3) list.push(row.label);
    badgesByUser.set(row.userId, list);
  }

  const items: NearbyBreederItem[] = ranked.map(({ user, sameRegion, distanceKm, isFollowing }) => {
    const programs = getSortedActiveBreederProgramSummaries(user.breederPrograms);
    return {
      id: user.id,
      name: user.name,
      image: user.avatar,
      topSpecies: speciesByUser.get(user.id)?.[0] ?? null,
      regionSido: user.regionSido,
      regionSigungu: user.regionSigungu,
      distanceKm,
      sameRegion,
      isFollowing,
      badges: badgesByUser.get(user.id) ?? [],
      breederPrograms: programs.map((program) => program.programType),
      // 옛 응답 필드
      user: { id: user.id, name: user.name, avatar: user.avatar },
      region: { sido: user.regionSido ?? "", sigungu: user.regionSigungu ?? "" },
      postsCount: user._count.posts,
      commentsCount: user._count.Comments,
      breederProgramSummaries: programs,
    };
  });

  return {
    scope: total > 0 ? "near" : "none",
    regionLabel: label,
    total,
    greetingCount,
    items,
    region,
  };
}
