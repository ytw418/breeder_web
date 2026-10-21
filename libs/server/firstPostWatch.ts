import client from "@libs/server/client";
import { findAdminUserIds } from "@libs/server/adminAccess";
import { sendPushToUsers } from "@libs/server/push";
import { newcomerSince } from "@libs/shared/newcomer";

/**
 * 새 회원 첫 글 지키기(커뮤니티 감사 #20). 가입 7일 안 회원의 첫 글이 2시간 넘게 보이는 댓글 0개면 운영자 계정에 알린다.
 * - 운영자 알림 목록에 NEW_POST 한 줄(보낸 사람 = 글쓴이, 누르면 글) + 운영자 기기 푸시.
 * - 같은 글은 한 번만: 이미 이 앞머리로 운영자 알림이 있는 글은 건너뛴다. 그래서 크론이 늦거나 겹쳐 돌아도 두 번 가지 않는다.
 * - 2~26시간 전 글을 본다. 매시 크론(GitHub Actions)이 기본이고, 하루 한 번 Vercel 크론이 빠진 것을 줍는다
 *   (Vercel Hobby 는 하루 한 번보다 잦은 크론을 못 쓴다).
 */
export const FIRST_POST_WATCH_MESSAGE_PREFIX = "아직 댓글이 없는 새 회원 첫 글이에요";
export const FIRST_POST_WATCH_MIN_AGE_MS = 2 * 60 * 60 * 1000;
export const FIRST_POST_WATCH_MAX_AGE_MS = 26 * 60 * 60 * 1000;
const MAX_POSTS_PER_RUN = 20;

export interface FirstPostWatchResult {
  posts: number;
  admins: number;
}

/** 운영자에게 알릴 글: 2~26시간 전, 가입 7일 안 작성자의 첫 글, 보이는 댓글 0, 아직 알리지 않은 글. */
export async function findQuietNewcomerFirstPosts(now: Date = new Date()) {
  const candidates = await client.post.findMany({
    where: {
      isHidden: false,
      OR: [{ category: null }, { category: { not: "공지" } }],
      createdAt: {
        gte: new Date(now.getTime() - FIRST_POST_WATCH_MAX_AGE_MS),
        lt: new Date(now.getTime() - FIRST_POST_WATCH_MIN_AGE_MS),
      },
      user: { status: "ACTIVE", createdAt: { gte: newcomerSince(now) } },
      comments: { none: { isHidden: false, deletedAt: null } },
    },
    select: { id: true, title: true, userId: true },
    orderBy: { createdAt: "asc" },
    take: MAX_POSTS_PER_RUN * 3,
  });
  if (!candidates.length) return [];

  // 그 사람의 첫 글인지: 작성자별 가장 작은 글 id 와 같아야 한다.
  const firstPostIds = new Set(
    (
      await client.post.groupBy({
        by: ["userId"],
        where: { userId: { in: Array.from(new Set(candidates.map((post) => post.userId))) } },
        _min: { id: true },
      })
    ).map((row) => row._min.id)
  );
  const firstPosts = candidates.filter((post) => firstPostIds.has(post.id));
  if (!firstPosts.length) return [];

  const alerted = new Set(
    (
      await client.notification.findMany({
        where: {
          type: "NEW_POST",
          targetType: "post",
          targetId: { in: firstPosts.map((post) => post.id) },
          message: { startsWith: FIRST_POST_WATCH_MESSAGE_PREFIX },
        },
        select: { targetId: true },
      })
    ).map((row) => row.targetId)
  );
  return firstPosts.filter((post) => !alerted.has(post.id)).slice(0, MAX_POSTS_PER_RUN);
}

export async function runFirstPostWatch(now: Date = new Date()): Promise<FirstPostWatchResult> {
  const posts = await findQuietNewcomerFirstPosts(now);
  if (!posts.length) return { posts: 0, admins: 0 };
  const adminIds = await findAdminUserIds();
  if (!adminIds.length) return { posts: 0, admins: 0 };

  for (const post of posts) {
    const message = `${FIRST_POST_WATCH_MESSAGE_PREFIX}: ${post.title}`;
    await client.notification.createMany({
      data: adminIds.map((userId) => ({
        type: "NEW_POST" as const,
        message,
        userId,
        senderId: post.userId,
        targetId: post.id,
        targetType: "post",
      })),
    });
    await sendPushToUsers(adminIds, {
      title: "새 회원 첫 글에 아직 댓글이 없어요",
      body: post.title,
      url: `/posts/${post.id}`,
      tag: `first-post-watch-${post.id}`,
    });
  }
  return { posts: posts.length, admins: adminIds.length };
}
