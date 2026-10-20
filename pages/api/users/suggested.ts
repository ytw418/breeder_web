import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import { blockedEitherWay } from "@libs/server/nearby";
import { getTopSpecies, getTopSpeciesByUserIds } from "@libs/server/profileSpecies";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

/**
 * GET /api/users/suggested?limit=3 — 팔로우 추천(가입 직후 '시작하기' 화면·반려생활 팔로잉 빈 상태, 2026-10-21 감사 19번).
 * - 후보: 최근 30일 글·댓글을 쓴 사람 + 같은 관심 카테고리를 고정한 사람 + 같은 시/군/구 사람(각 상한).
 * - 제외: 본인·차단 관계(양방향)·이미 팔로우한 사람·ACTIVE 가 아닌 계정. 글도 최근 활동도 없는 사람도 뺀다.
 * - 점수: 같은 고정 카테고리 또는 주력 종 3 + 같은 시/군/구 2 + 최근 7일 글·댓글 1. 같으면 최근 활동 → 글 수 순.
 */
export interface SuggestedUser {
  id: number;
  name: string;
  avatar: string | null;
  breederPrograms: BreederProgramSummary[];
  /** 주력 종(최대 2) */
  topSpecies: string[];
  postsCount: number;
  /** 화면에서 팔로우하면 SWR 캐시에서 true 로 바꾼다(서버는 팔로우 중인 사람을 빼고 주므로 늘 비어 있다). */
  isFollowing?: boolean;
}

export interface SuggestedUsersResponse {
  success: boolean;
  users: SuggestedUser[];
}

export const SUGGESTED_LIMIT_DEFAULT = 3;
export const SUGGESTED_LIMIT_MAX = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const POOL_DAYS = 30;
const ACTIVE_DAYS = 7;
/** 후보 묶음마다 DB 에서 읽는 최대 인원. */
const POOL_CAP = 200;

export async function getSuggestedUsers({
  viewerId,
  limit = SUGGESTED_LIMIT_DEFAULT,
  now = new Date(),
}: {
  viewerId: number;
  limit?: number;
  now?: Date;
}): Promise<SuggestedUser[]> {
  const [viewer, blocked, follows] = await Promise.all([
    client.user.findUnique({
      where: { id: viewerId },
      select: { pinnedCategoryIds: true, regionSido: true, regionSigungu: true },
    }),
    blockedEitherWay(viewerId),
    client.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
  ]);
  const excluded = new Set<number>([viewerId, ...blocked, ...follows.map((row) => row.followingId)]);
  const notIn = Array.from(excluded);
  const pins = viewer?.pinnedCategoryIds ?? [];
  const region =
    viewer?.regionSido && viewer.regionSigungu
      ? { regionSido: viewer.regionSido, regionSigungu: viewer.regionSigungu }
      : null;
  const poolSince = new Date(now.getTime() - POOL_DAYS * DAY_MS);

  const [recentPosts, recentComments, pinnedPeers, regionPeers, pinnedCategories, viewerSpecies] =
    await Promise.all([
      client.post.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: poolSince }, isHidden: false, userId: { notIn } },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: POOL_CAP,
      }),
      client.comment.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: poolSince }, isHidden: false, userId: { notIn } },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: POOL_CAP,
      }),
      pins.length
        ? client.user.findMany({
            where: { status: "ACTIVE", id: { notIn }, pinnedCategoryIds: { hasSome: pins } },
            select: { id: true },
            take: POOL_CAP,
          })
        : Promise.resolve([] as { id: number }[]),
      region
        ? client.user.findMany({
            where: { status: "ACTIVE", id: { notIn }, ...region },
            select: { id: true },
            take: POOL_CAP,
          })
        : Promise.resolve([] as { id: number }[]),
      pins.length
        ? client.category.findMany({ where: { id: { in: pins } }, select: { name: true } })
        : Promise.resolve([] as { name: string }[]),
      getTopSpecies(viewerId),
    ]);

  const lastActiveAt = new Map<number, number>();
  for (const row of [...recentPosts, ...recentComments]) {
    const at = row._max?.createdAt?.getTime() ?? 0;
    if (at > (lastActiveAt.get(row.userId) ?? 0)) lastActiveAt.set(row.userId, at);
  }
  const candidateIds = Array.from(
    new Set([
      ...Array.from(lastActiveAt.keys()),
      ...pinnedPeers.map((u) => u.id),
      ...regionPeers.map((u) => u.id),
    ])
  ).filter((id) => !excluded.has(id));
  if (candidateIds.length === 0) return [];

  const [users, speciesByUser] = await Promise.all([
    client.user.findMany({
      where: { id: { in: candidateIds }, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        avatar: true,
        pinnedCategoryIds: true,
        regionSido: true,
        regionSigungu: true,
        _count: { select: { posts: { where: { isHidden: false } } } },
        breederPrograms: { where: { status: "ACTIVE" }, select: breederProgramSummarySelect },
      },
    }),
    getTopSpeciesByUserIds(candidateIds),
  ]);

  const pinSet = new Set(pins);
  const mySpecies = new Set([...viewerSpecies, ...pinnedCategories.map((row) => row.name)]);
  const activeSince = now.getTime() - ACTIVE_DAYS * DAY_MS;

  return users
    .filter((user) => !excluded.has(user.id))
    .map((user) => {
      const topSpecies = speciesByUser.get(user.id) ?? [];
      const lastAt = lastActiveAt.get(user.id) ?? 0;
      const sameInterest =
        (user.pinnedCategoryIds ?? []).some((id) => pinSet.has(id)) ||
        topSpecies.some((label) => mySpecies.has(label));
      const sameRegion =
        Boolean(region) &&
        user.regionSido === region?.regionSido &&
        user.regionSigungu === region?.regionSigungu;
      const score = (sameInterest ? 3 : 0) + (sameRegion ? 2 : 0) + (lastAt >= activeSince ? 1 : 0);
      return { user, topSpecies, lastAt, score, postsCount: user._count.posts };
    })
    .filter((row) => row.postsCount > 0 || row.lastAt > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.lastAt - a.lastAt ||
        b.postsCount - a.postsCount ||
        a.user.id - b.user.id
    )
    .slice(0, limit)
    .map(({ user, topSpecies, postsCount }) => ({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      breederPrograms: getSortedActiveBreederProgramSummaries(user.breederPrograms),
      topSpecies,
      postsCount,
    }));
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const viewerId = req.user?.id;
  if (!viewerId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  const raw = Number(req.query.limit);
  const limit = Number.isInteger(raw)
    ? Math.min(Math.max(raw, 1), SUGGESTED_LIMIT_MAX)
    : SUGGESTED_LIMIT_DEFAULT;

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const users = await getSuggestedUsers({ viewerId, limit });
  return res.json({ success: true, users });
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: true }));
