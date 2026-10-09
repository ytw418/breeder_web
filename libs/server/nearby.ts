import client from "@libs/server/client";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import { getTopSpeciesByUserIds } from "@libs/server/profileSpecies";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import type { Region } from "@libs/shared/regions";

/**
 * 동네 브리더 조회.
 * - 같은 시/군/구에서 `regionVisible=true` 인 ACTIVE 사용자만. 본인과 차단 관계(양방향)는 뺀다.
 * - 시/군/구에 0명이면 같은 시/도로 넓히고(scope "sido"), 그래도 0명이면 scope "none".
 * - 정렬은 게시글+댓글 수 내림차순 → 동네 설정이 최근인 순. 거리·좌표는 다루지 않는다.
 * - 보이는 사람에게만 팔로우 여부·주력 종을 배치로 붙인다(홈 '우리 동네 브리더' 카드, 앱 docs/prd/home-neighborhood.md).
 */

export type NearbyScope = "sigungu" | "sido" | "none";

export interface NearbyBreederItem {
  user: { id: number; name: string; avatar: string | null };
  region: Region;
  postsCount: number;
  commentsCount: number;
  breederPrograms: BreederProgramSummary[];
  /** 조회자가 이 사람을 팔로우하는지 */
  isFollowing: boolean;
  /** 주력 종(최대 2개, 프로필과 같은 계산). 없으면 빈 배열 */
  topSpecies: string[];
}

export interface NearbyBreedersResult {
  scope: NearbyScope;
  /** 조회자의 동네. 미설정이면 null */
  region: Region | null;
  items: NearbyBreederItem[];
  /** 범위 안 인원(자르기 전). 후보는 SCAN_LIMIT 까지만 읽으므로 그 이상은 SCAN_LIMIT 로 보인다. */
  total: number;
}

export const NEARBY_LIMIT_DEFAULT = 3;
export const NEARBY_LIMIT_MAX = 50;
/** 정렬 전에 DB 에서 읽는 최대 인원. 한 시/군/구에 이보다 많아지면 그때 DB 정렬로 바꾼다. */
const SCAN_LIMIT = 200;

/** 어느 쪽이 차단했든 서로 목록에 보이지 않게 한다(피차단자에게 차단 사실을 드러내지 않는다). */
async function blockedEitherWay(viewerId: number): Promise<number[]> {
  const rows = await client.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId));
}

type BaseItem = Omit<NearbyBreederItem, "isFollowing" | "topSpecies">;

async function findVisibleBreeders(
  where: { regionSido: string; regionSigungu?: string },
  excludedIds: number[],
  limit: number
): Promise<{ items: BaseItem[]; total: number }> {
  const users = await client.user.findMany({
    where: {
      status: "ACTIVE",
      regionVisible: true,
      regionSido: where.regionSido,
      ...(where.regionSigungu ? { regionSigungu: where.regionSigungu } : {}),
      id: { notIn: excludedIds },
    },
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
  });

  const items = users
    .map((user) => ({
      user: { id: user.id, name: user.name, avatar: user.avatar },
      region: {
        sido: user.regionSido ?? "",
        sigungu: user.regionSigungu ?? "",
      },
      postsCount: user._count.posts,
      commentsCount: user._count.Comments,
      breederPrograms: getSortedActiveBreederProgramSummaries(user.breederPrograms),
      updatedAt: user.regionUpdatedAt?.getTime() ?? 0,
    }))
    .sort(
      (a, b) =>
        b.postsCount + b.commentsCount - (a.postsCount + a.commentsCount) ||
        b.updatedAt - a.updatedAt ||
        a.user.id - b.user.id
    )
    .slice(0, limit)
    .map(({ updatedAt: _updatedAt, ...item }) => item);
  return { items, total: users.length };
}

/** 보이는 사람에게만 팔로우 여부·주력 종을 붙인다(쿼리 3번, 인원과 무관). */
async function withViewerContext(
  viewerId: number,
  items: BaseItem[]
): Promise<NearbyBreederItem[]> {
  const ids = items.map((item) => item.user.id);
  const [follows, speciesByUser] = await Promise.all([
    client.follow.findMany({
      where: { followerId: viewerId, followingId: { in: ids } },
      select: { followingId: true },
    }),
    getTopSpeciesByUserIds(ids),
  ]);
  const followingIds = new Set(follows.map((row) => row.followingId));
  return items.map((item) => ({
    ...item,
    isFollowing: followingIds.has(item.user.id),
    topSpecies: speciesByUser.get(item.user.id) ?? [],
  }));
}

export async function getNearbyBreeders({
  viewerId,
  limit = NEARBY_LIMIT_DEFAULT,
}: {
  viewerId: number;
  limit?: number;
}): Promise<NearbyBreedersResult> {
  const viewer = await client.user.findUnique({
    where: { id: viewerId },
    select: { regionSido: true, regionSigungu: true },
  });
  if (!viewer?.regionSido || !viewer.regionSigungu) {
    return { scope: "none", region: null, items: [], total: 0 };
  }
  const region: Region = {
    sido: viewer.regionSido,
    sigungu: viewer.regionSigungu,
  };
  const excludedIds = [viewerId, ...(await blockedEitherWay(viewerId))];

  const inSigungu = await findVisibleBreeders(
    { regionSido: region.sido, regionSigungu: region.sigungu },
    excludedIds,
    limit
  );
  if (inSigungu.items.length > 0) {
    const items = await withViewerContext(viewerId, inSigungu.items);
    return { scope: "sigungu", region, items, total: inSigungu.total };
  }

  const inSido = await findVisibleBreeders({ regionSido: region.sido }, excludedIds, limit);
  if (inSido.items.length > 0) {
    const items = await withViewerContext(viewerId, inSido.items);
    return { scope: "sido", region, items, total: inSido.total };
  }

  return { scope: "none", region, items: [], total: 0 };
}
