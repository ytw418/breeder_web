import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { getAllCategories, resolveScopeCategoryIds } from "@libs/server/categories";
import { filterPushRecipients } from "@libs/server/notificationGate";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import {
  REENGAGEMENT_TYPES,
  debateClosingCopy,
  interestProductsCopy,
  isFreeProduct,
  isReengagementNight,
  kstDayStartOf,
  nearbyFreeCopy,
  questionHelpCopy,
  withinDailyCap,
  type PushCopy,
  type ReengagementType,
} from "@libs/server/reengagementRules";

/**
 * 재방문 알림 보내기(2026-10-23, 앱 docs/prd/reengagement-push.md). 규칙·문구는 libs/server/reengagementRules.ts.
 * ① 동네 무료 분양: 분양글 등록 직후(pages/api/products POST). 동네를 공개한(regionVisible) 분양자만 — 동네를 숨긴 사람의
 *    시/군/구가 알림으로 새지 않게 한다. 같은 시/군/구에 동네를 설정한 회원에게, 이 분양자 팔로워는 빼고(새 분양글 알림을 받는다).
 * ② 토론 마감 임박: 매시 크론. 1시간 안에 끝나는 회원 토론 중 표가 3개 이상인 것, 관심 분야가 맞고 아직 안 고른 회원에게.
 * ③ 관심 분야 새 분양 묶음: 매일 19시. 관심 분야를 고정한 회원에게 24시간 안 새 분양글 수(내 글 제외).
 * ④ 답 없는 질문: 매일 12시 반. 6시간~3일 된 답 없는 질문을 그 분야 글을 써 본 회원 15명에게(질문마다 한 번).
 * 모두: 활동 중 계정만, 서로 차단한 사람 제외, 하루 합계 2통·종류마다 1통, 알림 설정('팔로우·새 글'/'브리디 소식')·방해 금지·야간을 따른다.
 */

const DAY_MS = 24 * 3600_000;
const MAX_RECIPIENTS = 300;
export const DEBATE_CLOSING_WINDOW_MS = 75 * 60_000;
export const DEBATE_CLOSING_MIN_VOTES = 3;
const ACTIVE_WITHIN_DEBATE_MS = 14 * DAY_MS;
const ACTIVE_WITHIN_DIGEST_MS = 30 * DAY_MS;
const QUESTION_MIN_AGE_MS = 6 * 3600_000;
const QUESTION_MAX_AGE_MS = 3 * DAY_MS;
const QUESTION_MAX_PER_RUN = 10;
const QUESTION_HELPERS_PER_POST = 15;
const QUESTION_HELPER_LOOKBACK_MS = 180 * DAY_MS;

/** sender 와 어느 쪽으로든 차단 관계인 사람 id. */
async function blockedWith(senderId: number): Promise<number[]> {
  const rows = await client.userBlock.findMany({
    where: { OR: [{ blockerId: senderId }, { blockedId: senderId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === senderId ? row.blockedId : row.blockerId));
}

/** 오늘 이미 받은 재방문 알림을 보고 받을 수 있는 사람만. */
async function capFilter(userIds: number[], type: ReengagementType, now: Date): Promise<number[]> {
  if (!userIds.length) return [];
  const todayRows = await client.notification.findMany({
    where: {
      userId: { in: userIds },
      type: { in: [...REENGAGEMENT_TYPES] },
      createdAt: { gte: kstDayStartOf(now) },
    },
    select: { userId: true, type: true },
  });
  return withinDailyCap(userIds, todayRows, type);
}

/** 알림 행을 만들고, 야간이 아니면 설정상 받을 사람에게 푸시. 보낸 행 수를 돌려준다. */
async function deliver({
  type,
  recipients,
  senderId,
  copy,
  targetId,
  targetType,
  url,
  tag,
  now,
}: {
  type: ReengagementType;
  recipients: number[];
  /** null 이면 받는 사람 본인(시스템 알림 원으로 보인다). */
  senderId: number | null;
  copy: PushCopy;
  targetId: number;
  targetType: string;
  url: string;
  tag: string;
  now: Date;
}): Promise<number> {
  if (!recipients.length) return 0;
  await client.notification.createMany({
    data: recipients.map((userId) => ({
      type,
      message: copy.message,
      userId,
      senderId: senderId ?? userId,
      targetId,
      targetType,
    })),
  });
  if (isReengagementNight(now)) return recipients.length;
  const pushTo = await filterPushRecipients(recipients, type, now);
  if (pushTo.length) {
    try {
      await sendAllPushToUsers(pushTo, { title: copy.title, body: copy.body, url, tag });
    } catch (error) {
      console.error(`[reengagement:${type}] push failed:`, error);
    }
  }
  return recipients.length;
}

/* ① 동네 무료 분양 ------------------------------------------------------- */

export async function notifyNearbyFreeProduct(productId: number, now: Date = new Date()): Promise<number> {
  try {
    const product = await client.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        price: true,
        dealType: true,
        category: true,
        isHidden: true,
        isDeleted: true,
        userId: true,
        user: { select: { regionSido: true, regionSigungu: true, regionVisible: true, status: true } },
      },
    });
    if (!product || product.isHidden || product.isDeleted || !isFreeProduct(product)) return 0;
    const seller = product.user;
    if (!seller || seller.status !== "ACTIVE" || !seller.regionVisible) return 0;
    if (!seller.regionSido || !seller.regionSigungu) return 0;

    const [blocked, followers] = await Promise.all([
      blockedWith(product.userId),
      client.follow.findMany({ where: { followingId: product.userId }, select: { followerId: true } }),
    ]);
    const exclude = [product.userId, ...blocked, ...followers.map((row) => row.followerId)];
    const neighbors = (
      await client.user.findMany({
        where: {
          id: { notIn: exclude },
          status: "ACTIVE",
          regionSido: seller.regionSido,
          regionSigungu: seller.regionSigungu,
        },
        select: { id: true },
        orderBy: { lastActiveAt: { sort: "desc", nulls: "last" } },
        take: MAX_RECIPIENTS,
      })
    ).map((row) => row.id);
    const recipients = await capFilter(neighbors, "NEARBY_FREE_PRODUCT", now);
    return deliver({
      type: "NEARBY_FREE_PRODUCT",
      recipients,
      senderId: product.userId,
      copy: nearbyFreeCopy({ sigungu: seller.regionSigungu, species: product.category, title: product.name }),
      targetId: product.id,
      targetType: "product",
      url: `/products/${product.id}`,
      tag: `nearby-free-${product.id}`,
      now,
    });
  } catch (error) {
    console.error("[reengagement:NEARBY_FREE_PRODUCT] failed:", error);
    return 0;
  }
}

/* 관심 분야 ---------------------------------------------------------------- */

/** 관심 분야(고정 카테고리)가 이 categoryId 를 덮는 사람인지 판단할 고정 id 목록: 그 카테고리와 상위 전부. */
async function coveringPinIds(categoryId: number | null): Promise<number[] | null> {
  if (!categoryId) return null;
  const categories = await getAllCategories();
  const found = categories.find((row) => row.id === categoryId);
  if (!found) return null;
  return categories.filter((row) => found.path.startsWith(row.path)).map((row) => row.id);
}

async function categoryName(categoryId: number | null): Promise<string | null> {
  if (!categoryId) return null;
  const categories = await getAllCategories();
  return categories.find((row) => row.id === categoryId)?.name ?? null;
}

/* ② 토론 마감 임박 ------------------------------------------------------- */

export async function runDebateClosingAlerts(now: Date = new Date()): Promise<{ debates: number; sent: number }> {
  if (isReengagementNight(now)) return { debates: 0, sent: 0 };
  const closing = await client.debate.findMany({
    where: {
      endsAt: { gt: now, lte: new Date(now.getTime() + DEBATE_CLOSING_WINDOW_MS) },
      post: { isHidden: false, user: { status: "ACTIVE" } },
    },
    select: {
      postId: true,
      optionA: true,
      optionB: true,
      endsAt: true,
      post: { select: { title: true, userId: true, categoryId: true } },
    },
    orderBy: { endsAt: "asc" },
    take: 20,
  });
  if (!closing.length) return { debates: 0, sent: 0 };

  const alreadyDone = new Set(
    (
      await client.notification.findMany({
        where: { type: "DEBATE_CLOSING", targetId: { in: closing.map((row) => row.postId) } },
        select: { targetId: true },
        distinct: ["targetId"],
      })
    ).map((row) => row.targetId)
  );

  let debates = 0;
  let sent = 0;
  for (const debate of closing) {
    if (alreadyDone.has(debate.postId) || !debate.endsAt) continue;
    try {
      const votes = await client.debateVote.findMany({
        where: { postId: debate.postId },
        select: { userId: true, side: true },
      });
      if (votes.length < DEBATE_CLOSING_MIN_VOTES) continue;
      const authorId = debate.post.userId;
      const pins = await coveringPinIds(debate.post.categoryId);
      const scope: Prisma.UserWhereInput = pins
        ? { OR: [{ pinnedCategoryIds: { isEmpty: true } }, { pinnedCategoryIds: { hasSome: pins } }] }
        : {};
      const exclude = [authorId, ...(await blockedWith(authorId)), ...votes.map((vote) => vote.userId)];
      const audience = (
        await client.user.findMany({
          where: {
            id: { notIn: exclude },
            status: "ACTIVE",
            lastActiveAt: { gte: new Date(now.getTime() - ACTIVE_WITHIN_DEBATE_MS) },
            ...scope,
          },
          select: { id: true },
          orderBy: { lastActiveAt: "desc" },
          take: MAX_RECIPIENTS,
        })
      ).map((row) => row.id);
      const recipients = await capFilter(audience, "DEBATE_CLOSING", now);
      const aVotes = votes.filter((vote) => vote.side === "A").length;
      sent += await deliver({
        type: "DEBATE_CLOSING",
        recipients,
        senderId: authorId,
        copy: debateClosingCopy({
          question: debate.post.title,
          optionA: debate.optionA,
          optionB: debate.optionB,
          aVotes,
          bVotes: votes.length - aVotes,
          endsAt: debate.endsAt,
          now,
        }),
        targetId: debate.postId,
        targetType: "post",
        url: `/posts/${debate.postId}`,
        tag: `debate-closing-${debate.postId}`,
        now,
      });
      debates += 1;
    } catch (error) {
      console.error("[reengagement:DEBATE_CLOSING] debate failed:", debate.postId, error);
    }
  }
  return { debates, sent };
}

/* ③ 관심 분야 새 분양 묶음 ---------------------------------------------- */

export async function runInterestProductsDigest(now: Date = new Date()): Promise<{ audience: number; sent: number }> {
  if (isReengagementNight(now)) return { audience: 0, sent: 0 };
  const audience = await client.user.findMany({
    where: {
      status: "ACTIVE",
      NOT: { pinnedCategoryIds: { isEmpty: true } },
      lastActiveAt: { gte: new Date(now.getTime() - ACTIVE_WITHIN_DIGEST_MS) },
    },
    select: { id: true, pinnedCategoryIds: true },
    orderBy: { id: "asc" },
  });
  if (!audience.length) return { audience: 0, sent: 0 };

  const allowed = new Set(await capFilter(audience.map((user) => user.id), "INTEREST_PRODUCTS", now));
  const categories = await getAllCategories();
  const since = new Date(now.getTime() - DAY_MS);
  const productsByScope = new Map<string, Promise<{ id: number; name: string; userId: number }[]>>();
  const productsFor = (pinnedIds: number[]) => {
    const pinned = categories.filter((row) => pinnedIds.includes(row.id));
    const key = pinned
      .map((row) => row.id)
      .sort((a, b) => a - b)
      .join(",");
    let found = productsByScope.get(key);
    if (!found) {
      found = (async () => {
        const scopeIds = await resolveScopeCategoryIds(pinned.map((row) => row.path));
        if (!scopeIds || !scopeIds.length) return [];
        return client.product.findMany({
          where: {
            createdAt: { gte: since },
            categoryId: { in: scopeIds },
            isHidden: false,
            isDeleted: false,
            status: "판매중",
            user: { status: "ACTIVE" },
          },
          select: { id: true, name: true, userId: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
      })();
      productsByScope.set(key, found);
    }
    return { pinned, products: found };
  };

  let sent = 0;
  for (const user of audience) {
    if (!allowed.has(user.id)) continue;
    try {
      const { pinned, products } = productsFor(user.pinnedCategoryIds);
      if (!pinned.length) continue;
      const blocked = new Set(await blockedWith(user.id));
      const mine = (await products).filter((row) => row.userId !== user.id && !blocked.has(row.userId));
      if (!mine.length) continue;
      sent += await deliver({
        type: "INTEREST_PRODUCTS",
        recipients: [user.id],
        senderId: null,
        copy: interestProductsCopy({
          scopeLabel: pinned.length === 1 ? pinned[0].name : "관심 분야",
          titles: mine.map((row) => row.name),
          count: mine.length,
        }),
        // 누르면 분양 탭(관심 분야 범위가 걸려 있다). targetId 는 맨 위 분양글(대표 사진용).
        targetId: mine[0].id,
        targetType: "productList",
        url: "/products",
        tag: "interest-products",
        now,
      });
    } catch (error) {
      console.error("[reengagement:INTEREST_PRODUCTS] user failed:", user.id, error);
    }
  }
  return { audience: audience.length, sent };
}

/* ④ 답 없는 질문 ---------------------------------------------------------- */

export async function runQuestionHelpAlerts(now: Date = new Date()): Promise<{ questions: number; sent: number }> {
  if (isReengagementNight(now)) return { questions: 0, sent: 0 };
  const candidates = await client.post.findMany({
    where: {
      category: "질문",
      isHidden: false,
      categoryId: { not: null },
      createdAt: {
        gte: new Date(now.getTime() - QUESTION_MAX_AGE_MS),
        lte: new Date(now.getTime() - QUESTION_MIN_AGE_MS),
      },
      user: { status: "ACTIVE" },
    },
    select: { id: true, title: true, userId: true, categoryId: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  if (!candidates.length) return { questions: 0, sent: 0 };

  const ids = candidates.map((post) => post.id);
  const [commenters, alerted] = await Promise.all([
    client.comment.groupBy({
      by: ["postId", "userId"],
      where: { postId: { in: ids }, isHidden: false, deletedAt: null },
    }),
    client.notification.findMany({
      where: { type: "QUESTION_HELP", targetId: { in: ids } },
      select: { targetId: true },
      distinct: ["targetId"],
    }),
  ]);
  const authorOf = new Map(candidates.map((post) => [post.id, post.userId]));
  const answered = new Set(commenters.filter((row) => row.userId !== authorOf.get(row.postId)).map((row) => row.postId));
  const done = new Set(alerted.map((row) => row.targetId));
  const pending = candidates.filter((post) => !answered.has(post.id) && !done.has(post.id)).slice(0, QUESTION_MAX_PER_RUN);

  const categories = await getAllCategories();
  let questions = 0;
  let sent = 0;
  for (const post of pending) {
    try {
      const found = categories.find((row) => row.id === post.categoryId);
      if (!found) continue;
      // 그 종과 하위 종 글을 써 본 사람. 상위('파충류'로만 쓴 글)는 넣지 않는다 — 경험이 넓어 질문과 안 맞는다.
      const speciesIds = categories.filter((row) => row.path.startsWith(found.path)).map((row) => row.id);
      const exclude = [post.userId, ...(await blockedWith(post.userId))];
      const writers = await client.post.groupBy({
        by: ["userId"],
        where: {
          categoryId: { in: speciesIds },
          isHidden: false,
          userId: { notIn: exclude },
          createdAt: { gte: new Date(now.getTime() - QUESTION_HELPER_LOOKBACK_MS) },
          user: { status: "ACTIVE", lastActiveAt: { gte: new Date(now.getTime() - ACTIVE_WITHIN_DIGEST_MS) } },
        },
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: QUESTION_HELPERS_PER_POST * 3,
      });
      const recipients = (await capFilter(writers.map((row) => row.userId), "QUESTION_HELP", now)).slice(
        0,
        QUESTION_HELPERS_PER_POST
      );
      sent += await deliver({
        type: "QUESTION_HELP",
        recipients,
        senderId: post.userId,
        copy: questionHelpCopy({ species: await categoryName(post.categoryId), title: post.title }),
        targetId: post.id,
        targetType: "post",
        url: `/posts/${post.id}`,
        tag: `question-help-${post.id}`,
        now,
      });
      questions += 1;
    } catch (error) {
      console.error("[reengagement:QUESTION_HELP] post failed:", post.id, error);
    }
  }
  return { questions, sent };
}
