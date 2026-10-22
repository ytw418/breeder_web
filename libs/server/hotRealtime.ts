import client from "@libs/server/client";
import { RANKABLE_USER_WHERE } from "@libs/server/rankableUser";
import { categoryScopeWhere } from "@libs/server/categories";
import type { HotActivityKind, HotRealtimeMeta } from "@libs/shared/communityVibe";
import type { HotDiscussionItem } from "@libs/shared/ranking";
import { getHotDiscussions } from "@libs/server/ranking";

/**
 * 반려생활 '실시간 TOP 토론'(앱 docs/prd/community-vibe.md §3.5, AC-19).
 * 최근 24시간 활동 점수(댓글 3·좋아요 1·토론 투표 1, 반감기 6시간 감쇠)순. 24시간 안 활동 글이 3개 미만이면 7일로 넓히고,
 * 그래도 모자라면 7일 안 새 글(활동 없음, kind "post")로 채운다. 글마다 마지막 활동 시각·종류를 돌려준다.
 */

export const HOT_ACTIVITY_WEIGHTS = { comment: 3, like: 1, vote: 1 } as const;
export const HOT_HALF_LIFE_HOURS = 6;
/** 찬반 토론(2026-10-15, 앱 docs/prd/live-talk.md §3.3)도 후보다. 투표·선택 바꾸기가 1점. */
export const HOT_CATEGORIES = ["질문", "자유", "정보", "토론"];
const HOUR_MS = 60 * 60 * 1000;
const WINDOWS_HOURS = [24, 24 * 7] as const;
const MIN_RESULTS = 3;

export type HotActivityEvent = { postId: number; at: Date; kind: "comment" | "like" | "vote" };

export type HotRanked = HotRealtimeMeta & { postId: number };

/** 활동 이벤트 → 글별 점수·마지막 활동. 점수 내림차순 → 마지막 활동 최근 순 → id 큰 순. */
export function rankHotActivity(
  events: HotActivityEvent[],
  now: Date,
  halfLifeHours: number = HOT_HALF_LIFE_HOURS
): HotRanked[] {
  const byPost = new Map<number, { score: number; lastAt: Date; lastKind: HotActivityKind }>();
  for (const event of events) {
    const ageHours = Math.max(0, (now.getTime() - event.at.getTime()) / HOUR_MS);
    const points = HOT_ACTIVITY_WEIGHTS[event.kind] * Math.pow(0.5, ageHours / halfLifeHours);
    const current = byPost.get(event.postId);
    if (!current) {
      byPost.set(event.postId, { score: points, lastAt: event.at, lastKind: event.kind });
      continue;
    }
    current.score += points;
    if (event.at.getTime() > current.lastAt.getTime()) {
      current.lastAt = event.at;
      current.lastKind = event.kind;
    }
  }
  return Array.from(byPost, ([postId, v]) => ({
    postId,
    hotScore: Math.round(v.score * 100) / 100,
    lastActivityAt: v.lastAt.toISOString(),
    lastActivityKind: v.lastKind,
  })).sort(
    (a, b) =>
      b.hotScore - a.hotScore ||
      Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt) ||
      b.postId - a.postId
  );
}

/** 실시간 TOP 토론 글 id 와 메타(순서대로). excludedIds 는 viewer 가 차단한 작성자. */
export async function getRealtimeHotRanking({
  limit = 3,
  categoryPath,
  excludedIds = [],
  now = new Date(),
  windowsHours = WINDOWS_HOURS,
  halfLifeHours = HOT_HALF_LIFE_HOURS,
  categories = HOT_CATEGORIES,
}: {
  limit?: number;
  categoryPath?: string;
  excludedIds?: number[];
  now?: Date;
  /** 활동을 보는 기간(짧은 것부터). 결과가 모자라면 다음 기간으로 넓힌다. */
  windowsHours?: readonly number[];
  halfLifeHours?: number;
  /** null 이면 공지만 빼고 모든 카테고리. */
  categories?: string[] | null;
}): Promise<HotRanked[]> {
  const scope = await categoryScopeWhere(categoryPath);
  const postWhere = {
    category: categories ? { in: categories } : { not: "공지" },
    isHidden: false,
    user: RANKABLE_USER_WHERE,
    ...(Object.keys(scope).length ? { AND: [scope] } : {}),
    ...(excludedIds.length ? { userId: { notIn: excludedIds } } : {}),
  };

  let ranked: HotRanked[] = [];
  for (const hours of windowsHours) {
    const since = new Date(now.getTime() - hours * HOUR_MS);
    const [comments, likes, votes] = await Promise.all([
      client.comment.findMany({
        where: {
          isHidden: false,
          deletedAt: null,
          createdAt: { gte: since },
          post: postWhere,
          ...(excludedIds.length ? { userId: { notIn: excludedIds } } : {}),
        },
        select: { postId: true, createdAt: true },
      }),
      client.like.findMany({
        where: { createdAt: { gte: since }, post: postWhere },
        select: { postId: true, createdAt: true },
      }),
      // 투표·선택 바꾸기(updatedAt 이 마지막으로 고른 시각).
      client.debateVote.findMany({
        where: { updatedAt: { gte: since }, debate: { post: postWhere } },
        select: { postId: true, updatedAt: true },
      }),
    ]);
    ranked = rankHotActivity(
      [
        ...comments.map((c) => ({ postId: c.postId, at: c.createdAt, kind: "comment" as const })),
        ...likes.map((l) => ({ postId: l.postId, at: l.createdAt, kind: "like" as const })),
        ...votes.map((v) => ({ postId: v.postId, at: v.updatedAt, kind: "vote" as const })),
      ],
      now,
      halfLifeHours
    );
    if (ranked.length >= Math.min(limit, MIN_RESULTS)) break;
  }
  ranked = ranked.slice(0, limit);

  if (ranked.length < limit) {
    // 활동이 모자라면 7일 안 새 글로 채운다(마지막 활동 = 글 작성).
    const fresh = await client.post.findMany({
      where: {
        ...postWhere,
        createdAt: { gte: new Date(now.getTime() - windowsHours[windowsHours.length - 1] * HOUR_MS) },
        ...(ranked.length ? { id: { notIn: ranked.map((r) => r.postId) } } : {}),
      },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit - ranked.length,
    });
    ranked.push(
      ...fresh.map((p) => ({
        postId: p.id,
        hotScore: 0,
        lastActivityAt: p.createdAt.toISOString(),
        lastActivityKind: "post" as const,
      }))
    );
  }
  return ranked;
}

/**
 * 홈 '인기글 TOP 10'(2026-10-22 사용자 결정, 앱 docs/prd/home-v2.md S-1): 이번 주(7일) 댓글·좋아요·투표 점수순.
 * 공지만 빼고 모든 카테고리, 반감기 3일. 모자라면 7일 안 새 글로 채운다. 조회수는 쓰지 않는다(화면에도 숫자 없음).
 */
export const WEEKLY_HOT_WINDOWS_HOURS = [24 * 7] as const;
export const WEEKLY_HOT_HALF_LIFE_HOURS = 72;
export const WEEKLY_HOT_LIMIT = 10;

export function getWeeklyHotRanking(options: {
  limit?: number;
  categoryPath?: string;
  excludedIds?: number[];
  now?: Date;
}): Promise<HotRanked[]> {
  return getRealtimeHotRanking({
    limit: WEEKLY_HOT_LIMIT,
    ...options,
    windowsHours: WEEKLY_HOT_WINDOWS_HOURS,
    halfLifeHours: WEEKLY_HOT_HALF_LIFE_HOURS,
    categories: null,
  });
}

/**
 * 홈 피드 hotDiscussions 를 실시간 순서로(HotDiscussionItem + 마지막 활동 메타).
 * 7일 안에 활동·새 글이 하나도 없으면 예전 HOT 토론(7일 → 30일 → 전체 댓글순)으로 채운다.
 */
export async function getRealtimeHotDiscussions({
  limit = 5,
  categoryPath,
  now = new Date(),
}: {
  limit?: number;
  categoryPath?: string;
  now?: Date;
} = {}): Promise<HotDiscussionItem[]> {
  const ranked = await getRealtimeHotRanking({ limit, categoryPath, now });
  if (ranked.length === 0) return getHotDiscussions({ limit, categoryPath });
  const rows = await client.post.findMany({
    where: { id: { in: ranked.map((r) => r.postId) } },
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      category: true,
      createdAt: true,
      _count: { select: { comments: true, Likes: true } },
      user: { select: { id: true, name: true, avatar: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap(({ postId, ...meta }) => {
    const p = byId.get(postId);
    if (!p) return [];
    return [
      {
        id: p.id,
        title: p.title,
        description: p.description,
        image: p.image,
        category: p.category,
        createdAt: p.createdAt.toISOString(),
        commentsCount: p._count.comments,
        wonderCount: p._count.Likes,
        user: p.user,
        ...meta,
      },
    ];
  });
}
