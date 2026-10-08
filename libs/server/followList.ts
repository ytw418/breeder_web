import type { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { excludedAuthorIds, setViewerCacheHeader } from "@libs/server/blocks";
import type { ResponseType } from "@libs/server/withHandler";
import { parsePositiveIntId } from "@libs/shared/normalize";

/**
 * 팔로워·팔로잉 목록(앱 docs/prd/profile.md F-3).
 *
 * schema.prisma 의 관계 이름이 의미와 반대다(User.followers = 이 유저가 followerId 인 행).
 * 그래서 Follow 행을 직접 조회한다.
 * - followers(X): followingId = X 인 행의 follower
 * - following(X): followerId = X 인 행의 following
 *
 * 탈퇴(status=DELETED) 사용자와 viewer 가 차단한 사용자(단방향)는 뺀다. 차단은 팔로우를 양방향으로
 * 지우므로 실제로 빠지는 건 "남의 목록에 있는, 내가 차단한 사람"뿐이다.
 */

export type FollowListKind = "followers" | "following";

export const FOLLOW_LIST_DEFAULT_SIZE = 20;
export const FOLLOW_LIST_MAX_SIZE = 50;

export interface FollowListUser {
  id: number;
  name: string;
  avatar: string | null;
  bio: string | null;
  postsCount: number;
  /** 로그인한 viewer 가 이 사람을 팔로우하는지. 비로그인이면 false. */
  isFollowing: boolean;
  followedAt: string;
}

export interface FollowListResponse {
  success: true;
  users: FollowListUser[];
  pages: number;
  /** 필터(탈퇴·내가 차단) 뒤 전체 인원. 프로필 숫자와 다를 수 있다. */
  total: number;
}

const userSelect = {
  id: true,
  name: true,
  avatar: true,
  bio: true,
  _count: { select: { posts: true } },
} satisfies Prisma.UserSelect;

function parsePaging(query: NextApiRequest["query"]) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const rawSize = Math.floor(Number(query.size) || FOLLOW_LIST_DEFAULT_SIZE);
  const size = Math.min(Math.max(1, rawSize), FOLLOW_LIST_MAX_SIZE);
  return { page, size };
}

export function followListHandler(kind: FollowListKind) {
  return async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseType | FollowListResponse>
  ) {
    const userId = parsePositiveIntId(req.query.id);
    if (!userId) {
      return res.status(404).json({ success: false, message: "유저를 찾을 수 없습니다." });
    }
    const target = await client.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) {
      return res.status(404).json({ success: false, message: "유저를 찾을 수 없습니다." });
    }

    const viewerId = req.user?.id;
    const { page, size } = parsePaging(req.query);
    const blocked = await excludedAuthorIds(viewerId);
    const personFilter: Prisma.UserWhereInput = {
      status: { not: "DELETED" },
      ...(blocked.length ? { id: { notIn: blocked } } : {}),
    };
    const where: Prisma.FollowWhereInput =
      kind === "followers"
        ? { followingId: userId, follower: personFilter }
        : { followerId: userId, following: personFilter };

    const [rows, total] = await Promise.all([
      client.follow.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          ...(kind === "followers"
            ? { follower: { select: userSelect } }
            : { following: { select: userSelect } }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * size,
        take: size,
      }),
      client.follow.count({ where }),
    ]);

    // 같은 쌍의 팔로우 행이 중복으로 있을 수 있어(unique 제약 없음) 사람 기준으로 한 번만 둔다.
    const seen = new Set<number>();
    const people: { person: Prisma.UserGetPayload<{ select: typeof userSelect }>; followedAt: Date }[] = [];
    for (const row of rows as Array<{
      createdAt: Date;
      follower?: Prisma.UserGetPayload<{ select: typeof userSelect }>;
      following?: Prisma.UserGetPayload<{ select: typeof userSelect }>;
    }>) {
      const person = kind === "followers" ? row.follower : row.following;
      if (!person || seen.has(person.id)) continue;
      seen.add(person.id);
      people.push({ person, followedAt: row.createdAt });
    }

    let followingIds = new Set<number>();
    if (viewerId && people.length) {
      const mine = await client.follow.findMany({
        where: { followerId: viewerId, followingId: { in: people.map(({ person }) => person.id) } },
        select: { followingId: true },
      });
      followingIds = new Set(mine.map((row) => row.followingId));
    }

    setViewerCacheHeader(res, viewerId);
    return res.json({
      success: true,
      users: people.map(({ person, followedAt }) => ({
        id: person.id,
        name: person.name,
        avatar: person.avatar ?? null,
        bio: person.bio ?? null,
        postsCount: person._count.posts,
        isFollowing: followingIds.has(person.id),
        followedAt: followedAt.toISOString(),
      })),
      pages: Math.ceil(total / size),
      total,
    });
  };
}
