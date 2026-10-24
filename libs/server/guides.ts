import client from "@libs/server/client";
import { speciesCategoryIds } from "@libs/server/categories";
import { GUIDES } from "@/data/guides";
import type {
  GuideCommunity,
  GuideDetailResponse,
  GuideListResponse,
  GuideOnSaleItem,
  GuideSummary,
  SpeciesGuide,
} from "@libs/shared/guides";
import { groupGuides } from "@libs/shared/guides";

/**
 * 종별 사육 가이드(앱 docs/prd/species-guide.md). 본문은 data/guides/*.json, 회원 데이터는 DB 에서 묶는다.
 * 공개(published)만 내보낸다. draft 는 없는 것처럼 404.
 */
const POST_LIMIT = 3;
const ON_SALE_LIMIT = 10;

export const listPublishedGuides = (): SpeciesGuide[] => GUIDES.filter((g) => g.status === "published");

export const getPublishedGuide = (slug: string): SpeciesGuide | null =>
  listPublishedGuides().find((g) => g.slug === slug) ?? null;

/** 그 종(하위 포함)의 공개 글·분양 중 상품·진행 중 경매·혈통 수. 조회가 실패하면 null(본문은 그대로 보인다). */
export async function getGuideCommunity(species: string): Promise<GuideCommunity | null> {
  try {
    const ids = await speciesCategoryIds(species);
    if (!ids.length) return { counts: { posts: 0, products: 0, auctions: 0, bloodlines: 0 }, posts: [], onSale: [] };
    const categoryId = { in: ids };
    const postWhere = { categoryId, isHidden: false, NOT: { category: "공지" } };
    const productWhere = { categoryId, isDeleted: false, isHidden: false, externalSource: null, status: { in: ["판매중", "예약중"] } };
    const auctionWhere = { categoryId, isHidden: false, status: "진행중", endAt: { gt: new Date() } };

    const [posts, products, auctions, postCount, productCount, auctionCount, bloodlineCount] = await Promise.all([
      client.post.findMany({
        where: postWhere,
        select: {
          id: true,
          title: true,
          category: true,
          createdAt: true,
          _count: { select: { comments: { where: { isHidden: false, deletedAt: null } }, Likes: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: POST_LIMIT,
      }),
      client.product.findMany({
        where: productWhere,
        select: { id: true, name: true, price: true, photos: true, mainImage: true, status: true, dealType: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: ON_SALE_LIMIT,
      }),
      client.auction.findMany({
        where: auctionWhere,
        select: {
          id: true,
          title: true,
          currentPrice: true,
          startPrice: true,
          photos: true,
          endAt: true,
          createdAt: true,
          _count: { select: { bids: { where: { archivedAt: null } } } },
        },
        orderBy: [{ endAt: "asc" }, { id: "asc" }],
        take: ON_SALE_LIMIT,
      }),
      client.post.count({ where: postWhere }),
      client.product.count({ where: productWhere }),
      client.auction.count({ where: auctionWhere }),
      client.bloodlineCard.count({ where: { categoryId, cardType: "BLOODLINE", status: "ACTIVE" } }),
    ]);

    // 프로필 '지금 분양 중'과 같은 순서: 경매(마감 임박순) → 분양글(최신순).
    const onSale: GuideOnSaleItem[] = [
      ...auctions.map((a) => ({
        kind: "auction" as const,
        id: a.id,
        title: a.title,
        currentPrice: a.currentPrice,
        startPrice: a.startPrice,
        photo: a.photos?.[0] ?? null,
        endAt: a.endAt.toISOString(),
        bidCount: a._count.bids,
        createdAt: a.createdAt.toISOString(),
      })),
      ...products.map((p) => ({
        kind: "product" as const,
        id: p.id,
        name: p.name,
        price: p.price,
        photo: p.mainImage || p.photos?.[0] || null,
        status: p.status,
        dealType: p.dealType,
        createdAt: p.createdAt.toISOString(),
      })),
    ].slice(0, ON_SALE_LIMIT);

    return {
      counts: { posts: postCount, products: productCount, auctions: auctionCount, bloodlines: bloodlineCount },
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        comments: p._count.comments,
        likes: p._count.Likes,
        createdAt: p.createdAt.toISOString(),
      })),
      onSale,
    };
  } catch (error) {
    console.error("[guides] 회원 데이터 조회 실패", species, error);
    return null;
  }
}

const toSummary = async (guide: SpeciesGuide): Promise<GuideSummary> => {
  const community = await getGuideCommunity(guide.species);
  return {
    slug: guide.slug,
    species: guide.species,
    group: guide.group,
    title: guide.title,
    intro: guide.intro,
    counts: community?.counts ?? null,
  };
};

export async function getGuideList(): Promise<GuideListResponse> {
  const summaries = await Promise.all(listPublishedGuides().map(toSummary));
  return { success: true, groups: groupGuides(summaries) };
}

export async function getGuideDetail(slug: string): Promise<GuideDetailResponse | null> {
  const guide = getPublishedGuide(slug);
  if (!guide) return null;
  const community = await getGuideCommunity(guide.species);
  const related = listPublishedGuides()
    .filter((g) => g.group === guide.group && g.slug !== guide.slug)
    .map((g) => ({ slug: g.slug, species: g.species }));
  return { success: true, guide, community, related };
}
