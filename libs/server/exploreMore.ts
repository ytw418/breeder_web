import client from "@libs/server/client";
import { getRealtimeHotRanking } from "@libs/server/hotRealtime";
import { getProductPath } from "@libs/product-route";
import { toPostPath } from "@libs/post-route";
import { toAuctionPath } from "@libs/auction-route";
import { formatProductPrice } from "@libs/shared/price";
import { productStatusLabel } from "@libs/shared/productTerms";
import { pickExploreItems, type ExploreItem, type ExploreMoreData } from "@libs/shared/exploreMore";

/**
 * 공개 상세 페이지 아래 '더 둘러보기'(비슷한 글·인기 글·CTA) 데이터. 2026-10-16 사용자 결정 —
 * 검색·공유로 상세에 바로 들어온 사람이 다른 글로 이어 가고, 검색엔진이 내부 링크를 따라가게 한다.
 *
 * - ISR 캐시 HTML 에 들어가므로 좋아요·댓글 수·현재가·상대 시간 같은 실시간 값은 싣지 않는다(정적 메타만).
 * - 비로그인 HTML 이라 보는 사람의 차단 목록은 거르지 못한다(목록 API 와 다르다).
 * - 비슷한 글은 운영(크루) 계정 글도 넣는다(정상 콘텐츠). 인기 글은 랭킹 기준(getRealtimeHotRanking)이라 운영 계정을 뺀다.
 */
export type ExploreTarget =
  | { kind: "post"; id: number; category: string | null }
  | { kind: "product"; id: number; category: string | null }
  | { kind: "auction"; id: number; category: string | null }
  | { kind: "bloodline"; speciesType: string | null };

const SIMILAR_LIMIT = 6;
/** 인기 글은 현재 글·비슷한 글과 겹치는 것을 빼고 6개를 채우려고 넉넉히 받는다. */
const POPULAR_FETCH_LIMIT = 10;

const postItem = (post: {
  id: number;
  title: string;
  category: string | null;
  image: string;
  images: string[];
}): ExploreItem => ({
  kind: "post",
  id: post.id,
  href: toPostPath(post.id, post.title),
  title: post.title,
  image: post.images[0] || post.image || null,
  meta: post.category ?? "",
});

const productItem = (product: {
  id: number;
  name: string;
  category: string | null;
  price: number | null;
  status: string;
  photos: string[];
  mainImage: string | null;
}): ExploreItem => ({
  kind: "product",
  id: product.id,
  href: getProductPath(product.id, product.name),
  title: product.name,
  image: product.mainImage || product.photos[0] || null,
  meta: [product.category, formatProductPrice(product.price), productStatusLabel(product.status)]
    .filter(Boolean)
    .join(" · "),
});

const POST_SELECT = { id: true, title: true, category: true, image: true, images: true } as const;
const PRODUCT_SELECT = {
  id: true,
  name: true,
  category: true,
  price: true,
  status: true,
  photos: true,
  mainImage: true,
} as const;

const similarProducts = (category: string | null, excludeId?: number) =>
  client.product.findMany({
    where: {
      isHidden: false,
      isDeleted: false,
      status: { not: "판매완료" },
      ...(category ? { category } : {}),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: PRODUCT_SELECT,
    orderBy: { createdAt: "desc" },
    take: SIMILAR_LIMIT,
  });

async function loadSimilar(target: ExploreTarget): Promise<ExploreItem[]> {
  switch (target.kind) {
    case "post": {
      const rows = await client.post.findMany({
        where: {
          isHidden: false,
          id: { not: target.id },
          category: target.category ? target.category : { not: "공지" },
            },
        select: POST_SELECT,
        orderBy: { createdAt: "desc" },
        take: SIMILAR_LIMIT,
      });
      return rows.map(postItem);
    }
    case "product":
      return (await similarProducts(target.category, target.id)).map(productItem);
    case "auction": {
      const rows = await client.auction.findMany({
        where: {
          isHidden: false,
          id: { not: target.id },
          status: "진행중",
              ...(target.category ? { category: target.category } : {}),
        },
        select: { id: true, title: true, category: true, photos: true },
        orderBy: { endAt: "asc" },
        take: SIMILAR_LIMIT,
      });
      return rows.map((auction) => ({
        kind: "auction" as const,
        id: auction.id,
        href: toAuctionPath(auction.id, auction.title),
        title: auction.title,
        image: auction.photos[0] || null,
        meta: [auction.category, "진행 중 경매"].filter(Boolean).join(" · "),
      }));
    }
    case "bloodline":
      // 같은 종 분양글(종 이름 = 분양글 category). 없으면 최근 분양글.
      return (await similarProducts(target.speciesType)).map(productItem);
  }
}

async function loadPopular(): Promise<ExploreItem[]> {
  const ranked = await getRealtimeHotRanking({ limit: POPULAR_FETCH_LIMIT });
  if (!ranked.length) return [];
  const rows = await client.post.findMany({
    where: { id: { in: ranked.map((row) => row.postId) }, isHidden: false },
    select: POST_SELECT,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap(({ postId }) => {
    const row = byId.get(postId);
    return row ? [postItem(row)] : [];
  });
}

/** 지금 표가 가장 많은 진행 중 토론. 없으면 null(CTA 는 토론 모아보기로). */
async function loadHotDebate() {
  const debate = await client.debate.findFirst({
    where: { endsAt: { gt: new Date() }, post: { isHidden: false } },
    orderBy: { votes: { _count: "desc" } },
    select: { post: { select: { id: true, title: true } } },
  });
  return debate?.post ?? null;
}

export async function getExploreMore(
  target: ExploreTarget,
  /** 화면이 이미 비슷한 목록을 그리면(분양글 상세 '비슷한 분양' 그리드) false. */
  { includeSimilar = true }: { includeSimilar?: boolean } = {}
): Promise<ExploreMoreData> {
  try {
    const [similar, popular, hotDebate] = await Promise.all([
      includeSimilar ? loadSimilar(target) : Promise.resolve([]),
      loadPopular(),
      loadHotDebate(),
    ]);
    return pickExploreItems({
      similar,
      popular,
      currentPostId: target.kind === "post" ? target.id : null,
      hotDebate,
    });
  } catch (error) {
    // 둘러보기가 실패해도 상세는 그린다(CTA 만 남는다).
    console.warn("[exploreMore] failed", error instanceof Error ? error.message : error);
    return pickExploreItems({ similar: [], popular: [], currentPostId: null, hotDebate: null });
  }
}
