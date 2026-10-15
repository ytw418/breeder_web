import client from "@libs/server/client";
import { speciesCategoryIds } from "@libs/server/categories";
import {
  formatKakaoDigest,
  KAKAO_DIGEST_ROOMS,
  type KakaoDigestData,
  type KakaoDigestRoom,
} from "@libs/shared/kakaoDigest";

const HOUR_MS = 60 * 60 * 1000;
/** 새 분양글·마감 경매를 보는 기간 */
const DIGEST_WINDOW_MS = 24 * HOUR_MS;
/** 많이 본 이야기를 고르는 기간(하루치는 글이 적다) */
const POPULAR_WINDOW_MS = 3 * 24 * HOUR_MS;
/** 답 없는 질문을 보는 기간(관리자 '답 없는 글' 필터와 같다) */
const QUESTION_WINDOW_MS = 7 * 24 * HOUR_MS;

const LIST_LIMIT = { auctions: 3, products: 3, popular: 2, questions: 2 };

/** 종 조건: categoryId 가 채워진 글은 id 로, 옛 글은 이름으로 찾는다. */
const speciesWhere = (field: "category" | "type", ids: number[], aliases: string[]) => ({
  OR: [...(ids.length ? [{ categoryId: { in: ids } }] : []), { [field]: { in: aliases } }],
});

export interface KakaoDigestResult {
  room: KakaoDigestRoom;
  data: KakaoDigestData;
  text: string;
}

export async function buildKakaoDigest(
  room: KakaoDigestRoom,
  now: Date = new Date()
): Promise<KakaoDigestResult> {
  const ids = await speciesCategoryIds(room.species);
  const since = new Date(now.getTime() - DIGEST_WINDOW_MS);
  const productWhere = {
    isHidden: false,
    isDeleted: false,
    status: "판매중",
    createdAt: { gte: since },
    ...speciesWhere("category", ids, room.aliases),
  };
  const postSpecies = speciesWhere("type", ids, room.aliases);

  const [endingAuctions, newProducts, newProductCount, openQuestions, popularPosts] =
    await Promise.all([
      client.auction.findMany({
        where: {
          isHidden: false,
          status: "진행중",
          endAt: { gt: now, lte: new Date(now.getTime() + DIGEST_WINDOW_MS) },
          ...speciesWhere("category", ids, room.aliases),
        },
        orderBy: { endAt: "asc" },
        take: LIST_LIMIT.auctions,
        select: { id: true, title: true, currentPrice: true, endAt: true },
      }),
      client.product.findMany({
        where: productWhere,
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT.products,
        select: { id: true, name: true, price: true, dealType: true, location: true },
      }),
      client.product.count({ where: productWhere }),
      client.post.findMany({
        where: {
          isHidden: false,
          category: "질문",
          createdAt: { gte: new Date(now.getTime() - QUESTION_WINDOW_MS) },
          comments: { none: { isHidden: false, deletedAt: null } },
          ...postSpecies,
        },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT.questions,
        select: { id: true, title: true },
      }),
      client.post.findMany({
        where: {
          isHidden: false,
          NOT: { category: { in: ["공지", "질문"] } },
          createdAt: { gte: new Date(now.getTime() - POPULAR_WINDOW_MS) },
          OR: [{ Likes: { some: {} } }, { comments: { some: { isHidden: false, deletedAt: null } } }],
          AND: [postSpecies],
        },
        orderBy: [{ Likes: { _count: "desc" } }, { comments: { _count: "desc" } }],
        take: LIST_LIMIT.popular,
        select: { id: true, title: true },
      }),
    ]);

  const data: KakaoDigestData = {
    endingAuctions,
    newProducts,
    newProductCount,
    openQuestions,
    popularPosts,
  };
  return { room, data, text: formatKakaoDigest(room, data, now) };
}

export const buildAllKakaoDigests = (now: Date = new Date()) =>
  Promise.all(KAKAO_DIGEST_ROOMS.map((room) => buildKakaoDigest(room, now)));

/**
 * 슬랙 Incoming Webhook 으로 문구를 보낸다. 카톡에 그대로 복사하도록 코드 블록에 넣는다.
 * 웹훅이 없으면(로컬·프리뷰) 보내지 않고 false.
 */
export async function sendKakaoDigestToSlack(digests: KakaoDigestResult[]): Promise<boolean> {
  const webhookUrl = process.env.KAKAO_DIGEST_SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const text = digests
    .map(({ room, text: body }) => `*${room.emoji} ${room.label} 오픈채팅방 소식* — 복사해서 붙여넣어 주세요\n\`\`\`${body}\`\`\``)
    .join("\n\n");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook ${res.status}`);
  }
  return true;
}
