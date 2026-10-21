import client from "@libs/server/client";
import { getAllCategories, resolveScopeCategoryIds } from "@libs/server/categories";
import { filterPushRecipients } from "@libs/server/notificationGate";
import { sendAllPushToUsers } from "@libs/server/pushGateway";

/**
 * 주간 요약 푸시(커뮤니티 감사 #22). 3~10일 안 온 회원에게 월요일 오전 한 통:
 * '이번 주 ○○ 인기글 3개 · 내 글 반응 N개'(반응 0이면 뒷부분 생략). 누르면 홈.
 * - 대상: 활동 중 계정, 마지막 활동(lastActiveAt)이 3~10일 전, 푸시 받을 기기가 있는 사람.
 * - '브리디 소식' 알림을 껐거나 방해 금지 시간이면 보내지 않는다(WEEKLY_DIGEST → news, libs/shared/notificationPrefs).
 * - 6일 안에 이미 받았으면 건너뛴다(크론이 다시 돌아도 주 1통).
 * - 인기글: 7일 안 글, 관심 분야 범위(없거나 비면 전체), 좋아요+댓글 많은 순. 인기글도 반응도 없으면 보내지 않는다.
 * 알림 행은 받는 사람 본인이 보낸 사람이다(시스템 알림 원으로 보인다).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const DIGEST_INACTIVE_MIN_DAYS = 3;
export const DIGEST_INACTIVE_MAX_DAYS = 10;
const DIGEST_WINDOW_DAYS = 7;
const DIGEST_REPEAT_GUARD_DAYS = 6;
const DIGEST_POST_COUNT = 3;
const DIGEST_POST_SCAN = 300;

export interface DigestAudienceUser {
  id: number;
  pinnedCategoryIds: number[];
}

export interface WeeklyDigest {
  title: string;
  body: string;
  postIds: number[];
  reactions: number;
}

/** 대상: ACTIVE · lastActiveAt ∈ [now-10일, now-3일] · 푸시 기기 있음. */
export async function selectDigestAudience(now: Date = new Date()): Promise<DigestAudienceUser[]> {
  return client.user.findMany({
    where: {
      status: "ACTIVE",
      lastActiveAt: {
        gte: new Date(now.getTime() - DIGEST_INACTIVE_MAX_DAYS * DAY_MS),
        lte: new Date(now.getTime() - DIGEST_INACTIVE_MIN_DAYS * DAY_MS),
      },
      fcmTokens: { some: {} },
    },
    select: { id: true, pinnedCategoryIds: true },
    orderBy: { id: "asc" },
  });
}

/** '이번 주 크레스티드 게코 인기글 3개 · 내 글 반응 5개'. 종이 없으면 '이번 주 인기글 3개', 글이 없으면 반응만. */
export function formatDigestTitle({
  scopeLabel,
  postCount,
  reactions,
}: {
  scopeLabel: string;
  postCount: number;
  reactions: number;
}): string {
  const parts = [
    postCount > 0 ? `이번 주 ${scopeLabel ? `${scopeLabel} ` : ""}인기글 ${postCount}개` : null,
    reactions > 0 ? `${postCount > 0 ? "" : "이번 주 "}내 글 반응 ${reactions}개` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

type PopularPost = { id: number; title: string };

/** 7일 안 인기글(좋아요+댓글 순, 반응 0 글 제외). scopeIds 가 null 이면 전체. */
async function findPopularPosts(scopeIds: number[] | null, now: Date): Promise<PopularPost[]> {
  if (scopeIds && scopeIds.length === 0) return [];
  const rows = await client.post.findMany({
    where: {
      isHidden: false,
      OR: [{ category: null }, { category: { not: "공지" } }],
      createdAt: { gte: new Date(now.getTime() - DIGEST_WINDOW_DAYS * DAY_MS) },
      user: { status: "ACTIVE" },
      ...(scopeIds ? { categoryId: { in: scopeIds } } : {}),
    },
    select: { id: true, title: true, _count: { select: { Likes: true, comments: true } } },
    orderBy: { createdAt: "desc" },
    take: DIGEST_POST_SCAN,
  });
  return rows
    .map((row) => ({ id: row.id, title: row.title, score: row._count.Likes + row._count.comments }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.id - a.id)
    .slice(0, DIGEST_POST_COUNT)
    .map(({ id, title }) => ({ id, title }));
}

/** 7일 동안 내 글에 다른 사람이 남긴 좋아요 + 보이는 댓글 수. */
async function countMyPostReactions(userId: number, now: Date): Promise<number> {
  const since = new Date(now.getTime() - DIGEST_WINDOW_DAYS * DAY_MS);
  const [likes, comments] = await Promise.all([
    client.like.count({ where: { createdAt: { gte: since }, userId: { not: userId }, post: { userId } } }),
    client.comment.count({
      where: {
        createdAt: { gte: since },
        userId: { not: userId },
        isHidden: false,
        deletedAt: null,
        post: { userId },
      },
    }),
  ]);
  return likes + comments;
}

/** 실행 한 번 동안 같은 관심 분야끼리 인기글을 다시 찾지 않는다. */
export function createDigestBuilder(now: Date = new Date()) {
  const popularByScope = new Map<string, Promise<PopularPost[]>>();
  const popular = (key: string, scopeIds: number[] | null) => {
    let found = popularByScope.get(key);
    if (!found) {
      found = findPopularPosts(scopeIds, now);
      popularByScope.set(key, found);
    }
    return found;
  };

  return async function buildDigest(user: DigestAudienceUser): Promise<WeeklyDigest | null> {
    const categories = await getAllCategories();
    const pinned = categories.filter((row) => user.pinnedCategoryIds.includes(row.id));
    let scopeLabel = "";
    let posts: PopularPost[] = [];
    if (pinned.length) {
      const key = pinned
        .map((row) => row.id)
        .sort((a, b) => a - b)
        .join(",");
      const scopeIds = await resolveScopeCategoryIds(pinned.map((row) => row.path));
      posts = await popular(key, scopeIds ?? null);
      scopeLabel = pinned.length === 1 ? pinned[0].name : "관심 분야";
    }
    if (!posts.length) {
      scopeLabel = "";
      posts = await popular("all", null);
    }
    const reactions = await countMyPostReactions(user.id, now);
    const title = formatDigestTitle({ scopeLabel, postCount: posts.length, reactions });
    if (!title) return null;
    return {
      title,
      body: posts.length ? posts.map((post) => post.title).join(" / ") : "내 글에 남긴 반응을 확인해 보세요",
      postIds: posts.map((post) => post.id),
      reactions,
    };
  };
}

export interface WeeklyDigestRunResult {
  audience: number;
  sent: number;
}

export async function runWeeklyDigest(now: Date = new Date()): Promise<WeeklyDigestRunResult> {
  const audience = await selectDigestAudience(now);
  if (!audience.length) return { audience: 0, sent: 0 };

  const allowed = new Set(await filterPushRecipients(audience.map((user) => user.id), "WEEKLY_DIGEST", now));
  const alreadySent = new Set(
    (
      await client.notification.findMany({
        where: {
          type: "WEEKLY_DIGEST",
          userId: { in: audience.map((user) => user.id) },
          createdAt: { gte: new Date(now.getTime() - DIGEST_REPEAT_GUARD_DAYS * DAY_MS) },
        },
        select: { userId: true },
      })
    ).map((row) => row.userId)
  );

  const buildDigest = createDigestBuilder(now);
  let sent = 0;
  for (const user of audience) {
    if (!allowed.has(user.id) || alreadySent.has(user.id)) continue;
    try {
      const digest = await buildDigest(user);
      if (!digest) continue;
      await client.notification.create({
        data: { type: "WEEKLY_DIGEST", message: digest.title, userId: user.id, senderId: user.id },
      });
      await sendAllPushToUsers([user.id], {
        title: digest.title,
        body: digest.body,
        url: "/",
        tag: "weekly-digest",
      });
      sent += 1;
    } catch (error) {
      console.error("[weeklyDigest] user failed:", user.id, error);
    }
  }
  return { audience: audience.length, sent };
}
