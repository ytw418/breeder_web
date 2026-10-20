import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import { shouldPushTo } from "@libs/server/notificationGate";
import {
  buildDebateSummary,
  DEBATE_CATEGORY,
  DEBATE_MILESTONES,
  resultNotificationMessage,
  type DebateSide,
  type DebateSummary,
} from "@libs/shared/debateFormat";

/**
 * 찬반 토론 서버 로직(앱 docs/prd/live-talk.md §4). 집계는 저장하지 않고 DebateVote 에서 센다.
 */

type PostRef = { id: number; userId: number; category: string | null };

/** 토론 글 요약을 글 id → 요약으로. 토론이 아닌 글은 빠진다. */
export async function getDebateSummaries(
  posts: PostRef[],
  viewerId?: number,
  now = new Date()
): Promise<Map<number, DebateSummary>> {
  const ids = posts.filter((post) => post.category === DEBATE_CATEGORY).map((post) => post.id);
  const result = new Map<number, DebateSummary>();
  if (!ids.length) return result;
  const [debates, counts, switches, mine, lastComments] = await Promise.all([
    client.debate.findMany({ where: { postId: { in: ids } } }),
    client.debateVote.groupBy({
      by: ["postId", "side"],
      where: { postId: { in: ids } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    client.debateVote.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, switchedAt: { not: null } },
      _count: { _all: true },
    }),
    viewerId
      ? client.debateVote.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true, side: true },
        })
      : Promise.resolve([] as { postId: number; side: DebateSide }[]),
    client.comment.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, isHidden: false, deletedAt: null },
      _max: { createdAt: true },
    }),
  ]);
  const authorById = new Map(posts.map((post) => [post.id, post.userId]));
  const mySide = new Map(mine.map((vote) => [vote.postId, vote.side as DebateSide]));
  const switchCount = new Map(switches.map((row) => [row.postId, row._count._all]));
  const lastComment = new Map(lastComments.map((row) => [row.postId, row._max.createdAt]));
  for (const debate of debates) {
    const rows = counts.filter((row) => row.postId === debate.postId);
    const countA = rows.find((row) => row.side === "A")?._count._all ?? 0;
    const countB = rows.find((row) => row.side === "B")?._count._all ?? 0;
    const lastVote = rows
      .map((row) => row._max.updatedAt?.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const lastCommentAt = lastComment.get(debate.postId)?.getTime() ?? 0;
    // 사람이 움직인 시각만(만든 시각은 빼서 새 토론이 "방금 댓글"로 보이지 않게 한다).
    const last = Math.max(lastVote, lastCommentAt);
    result.set(
      debate.postId,
      buildDebateSummary(
        {
          optionA: debate.optionA,
          optionB: debate.optionB,
          endsAt: debate.endsAt,
          countA,
          countB,
          mySide: mySide.get(debate.postId) ?? null,
          switchCount: switchCount.get(debate.postId) ?? 0,
          lastActivityAt: last ? new Date(last) : null,
          lastActivityKind: last ? (lastCommentAt >= lastVote ? "comment" : "vote") : null,
          isAuthor: viewerId != null && authorById.get(debate.postId) === viewerId,
          firstOtherVoteAt: debate.firstOtherVoteAt,
        },
        now.getTime()
      )
    );
  }
  return result;
}

/** 목록 글에 debate 필드를 붙인다(토론이 아니면 null). 끝난 토론은 결과 알림을 한 번 만든다. */
export async function attachDebates<T extends PostRef>(
  posts: T[],
  viewerId?: number
): Promise<(T & { debate: DebateSummary | null })[]> {
  const summaries = await getDebateSummaries(posts, viewerId);
  const ended = Array.from(summaries.entries()).filter(([, summary]) => summary.state !== "open");
  if (ended.length) {
    // 응답을 막지 않고 뒤에서 만든다(이미 만든 토론은 notifyDebateResult 가 건너뛴다).
    void Promise.all(ended.map(([postId]) => notifyDebateResult(postId).catch(() => undefined)));
  }
  return posts.map((post) => ({ ...post, debate: summaries.get(post.id) ?? null }));
}

export class DebateError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string
  ) {
    super(message);
  }
}

/** 투표·선택 바꾸기. 같은 쪽을 다시 고르면 아무것도 바뀌지 않는다. */
export async function castDebateVote({
  postId,
  userId,
  side,
  now = new Date(),
}: {
  postId: number;
  userId: number;
  side: DebateSide;
  now?: Date;
}): Promise<DebateSummary> {
  const debate = await client.debate.findUnique({
    where: { postId },
    include: { post: { select: { id: true, userId: true, isHidden: true, category: true, title: true } } },
  });
  if (!debate || debate.post.isHidden) throw new DebateError(404, "DEBATE_NOT_FOUND", "토론을 찾을 수 없어요");
  if (now.getTime() >= debate.endsAt.getTime()) {
    throw new DebateError(409, "DEBATE_CLOSED", "방금 끝난 토론이에요");
  }
  const isAuthor = debate.post.userId === userId;
  let isNewVote = false;
  await client.$transaction(async (tx) => {
    const existing = await tx.debateVote.findUnique({ where: { postId_userId: { postId, userId } } });
    if (!existing) {
      await tx.debateVote.create({ data: { postId, userId, side } });
      isNewVote = true;
    } else if (existing.side !== side) {
      await tx.debateVote.update({ where: { id: existing.id }, data: { side, switchedAt: now } });
    }
    if (!isAuthor && !debate.firstOtherVoteAt) {
      await tx.debate.updateMany({
        where: { postId, firstOtherVoteAt: null },
        data: { firstOtherVoteAt: now },
      });
    }
  });
  const summary = (await getDebateSummaries([debate.post], userId, now)).get(postId);
  if (!summary) throw new DebateError(404, "DEBATE_NOT_FOUND", "토론을 찾을 수 없어요");
  // 참여 5·20·50명째 새 투표면 작성자에게 알린다.
  if (isNewVote && !isAuthor && (DEBATE_MILESTONES as readonly number[]).includes(summary.participants)) {
    await createNotification({
      type: "DEBATE_MILESTONE",
      userId: debate.post.userId,
      senderId: userId,
      message: `내 토론에 ${summary.participants}명이 참여했어요 · ${debate.post.title.slice(0, 20)}`,
      targetId: postId,
      targetType: "post",
    });
  }
  return summary;
}

/**
 * 끝난 토론의 앱 안 결과 알림(한 번만). decided 는 투표자 + 작성자, undecided 는 작성자에게만.
 * 푸시는 보내지 않는다(하루 한 번 묶음 푸시 — sendDebateDigestPush).
 */
export async function notifyDebateResult(postId: number, now = new Date()): Promise<boolean> {
  const claimed = await client.debate.updateMany({
    where: { postId, resultNotifiedAt: null, endsAt: { lte: now } },
    data: { resultNotifiedAt: now },
  });
  if (claimed.count === 0) return false;
  const debate = await client.debate.findUnique({
    where: { postId },
    include: { post: { select: { id: true, userId: true, category: true, isHidden: true } } },
  });
  if (!debate || debate.post.isHidden) return false;
  const summary = (await getDebateSummaries([debate.post], undefined, now)).get(postId);
  if (!summary) return false;
  const authorId = debate.post.userId;
  if (summary.state === "undecided") {
    await createNotification({
      type: "DEBATE_RESULT",
      userId: authorId,
      senderId: authorId,
      allowSelf: true,
      sendPush: false,
      message: "참여가 적어 결론을 못 냈어요 · 비슷한 토론을 열어 보세요",
      targetId: postId,
      targetType: "post",
    });
    return true;
  }
  const message = resultNotificationMessage(summary);
  if (!message) return false;
  const voters = await client.debateVote.findMany({ where: { postId }, select: { userId: true } });
  const recipients = Array.from(new Set([authorId, ...voters.map((vote) => vote.userId)]));
  for (const userId of recipients) {
    await createNotification({
      type: "DEBATE_RESULT",
      userId,
      senderId: authorId,
      allowSelf: true,
      sendPush: false,
      message,
      targetId: postId,
      targetType: "post",
    });
  }
  return true;
}

/** 크론: 끝났는데 알림을 안 만든 토론을 처리한다. */
export async function notifyEndedDebates(now = new Date(), limit = 100): Promise<number> {
  const pending = await client.debate.findMany({
    where: { resultNotifiedAt: null, endsAt: { lte: now } },
    select: { postId: true },
    take: limit,
    orderBy: { endsAt: "asc" },
  });
  let done = 0;
  for (const { postId } of pending) {
    if (await notifyDebateResult(postId, now)) done += 1;
  }
  return done;
}

/** 크론(하루 한 번, 20:00 KST): 최근 24시간 결과 알림을 받은 사람에게 묶음 푸시 한 통. */
export async function sendDebateDigestPush(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 24 * 3600_000);
  const rows = await client.notification.groupBy({
    by: ["userId"],
    where: { type: "DEBATE_RESULT", createdAt: { gte: since } },
    _count: { _all: true },
  });
  for (const row of rows) {
    // '브리디 소식'을 껐거나 방해 금지 시간이면 묶음 푸시도 보내지 않는다(결과 알림은 목록에 있다).
    if (!(await shouldPushTo(row.userId, "DEBATE_RESULT", now))) continue;
    await sendAllPushToUsers([row.userId], {
      title: "브리디 토론",
      body: `오늘 끝난 토론 ${row._count._all}개 결과가 나왔어요`,
      url: "/notifications",
      tag: `debate-digest-${now.toISOString().slice(0, 10)}`,
    }).catch(() => undefined);
  }
  return rows.length;
}

/**
 * 홈 '실시간 TOP 토론' 맨 위 카드(§3.2): 진행 중 토론 중 내가 안 고른 것의 활동 점수 1위.
 * 다 골랐으면 1위를 결과 상태로. 최근 24시간 활동(투표·댓글·작성)이 없는 토론은 후보가 아니다.
 */
export async function pickHomeDebate({
  viewerId,
  excludedIds = [],
  categoryPath,
  now = new Date(),
}: {
  viewerId?: number;
  excludedIds?: number[];
  categoryPath?: string;
  now?: Date;
}) {
  const since = new Date(now.getTime() - 24 * 3600_000);
  const { categoryScopeWhere } = await import("@libs/server/categories");
  const scope = await categoryScopeWhere(categoryPath);
  const candidates = await client.post.findMany({
    where: {
      category: DEBATE_CATEGORY,
      isHidden: false,
      user: { status: "ACTIVE" },
      debate: { endsAt: { gt: now } },
      ...(Object.keys(scope).length ? { AND: [scope] } : {}),
      ...(excludedIds.length ? { userId: { notIn: excludedIds } } : {}),
      OR: [
        { createdAt: { gte: since } },
        { comments: { some: { createdAt: { gte: since }, isHidden: false, deletedAt: null } } },
        { debate: { votes: { some: { updatedAt: { gte: since } } } } },
      ],
    },
    select: { id: true, title: true, type: true, userId: true, category: true },
    take: 30,
  });
  if (!candidates.length) return null;
  const summaries = await getDebateSummaries(candidates, viewerId, now);
  const { getRealtimeHotRanking } = await import("@libs/server/hotRealtime");
  const ranked = await getRealtimeHotRanking({ limit: 10, categoryPath, excludedIds, now });
  const rank = new Map(ranked.map((row, index) => [row.postId, index]));
  const sorted = candidates
    .map((post) => ({ post, summary: summaries.get(post.id) }))
    .filter((row): row is { post: typeof candidates[number]; summary: DebateSummary } => !!row.summary)
    .sort(
      (a, b) =>
        (rank.get(a.post.id) ?? 99) - (rank.get(b.post.id) ?? 99) ||
        Date.parse(b.summary.lastActivityAt ?? "0") - Date.parse(a.summary.lastActivityAt ?? "0")
    );
  const pick = sorted.find((row) => !row.summary.mySide) ?? sorted[0];
  if (!pick) return null;
  return {
    id: pick.post.id,
    title: pick.post.title,
    type: pick.post.type,
    userId: pick.post.userId,
    debate: pick.summary,
  };
}

/** KST 오늘 0시(UTC Date). 토론 열기 하루 한도에 쓴다. */
export function kstDayStart(now = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000);
}
