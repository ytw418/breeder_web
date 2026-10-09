import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { setViewerCacheHeader } from "@libs/server/blocks";
import { parsePositiveIntId } from "@libs/shared/normalize";

/**
 * GET /api/users/:id/on-sale?limit=10 — 프로필 '지금 분양 중' 줄(앱 docs/prd/profile.md v5 F-17).
 * 판매중·예약중 상품 + 진행 중(마감 전) 경매. 경매(마감 임박순) → 상품(최신순)으로 잇고 limit 로 자른다.
 * 쇼케이스라 본인에게도 숨김·삭제 글은 넣지 않는다. 경매 정산이 늦게 돌아도 마감이 지난 경매는 빼야 해서
 * status 와 함께 endAt > 지금 을 건다.
 */

export type OnSaleItem =
  | {
      kind: "product";
      id: number;
      name: string;
      price: number | null;
      photo: string | null;
      status: string;
      dealType: string;
      createdAt: string;
    }
  | {
      kind: "auction";
      id: number;
      title: string;
      currentPrice: number;
      startPrice: number;
      photo: string | null;
      endAt: string;
      bidCount: number;
      createdAt: string;
    };

export interface UserOnSaleResponse {
  success: boolean;
  items: OnSaleItem[];
  /** limit 와 상관없는 전체 수 */
  total: { products: number; auctions: number };
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType | UserOnSaleResponse>) {
  const userId = parsePositiveIntId(req.query.id);
  if (!userId) {
    return res.status(404).json({ success: false, message: "유저를 찾을 수 없습니다." });
  }
  const rawLimit = Number(req.query.limit);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  // 로그인 viewer 는 캐시하지 않는다(방금 올린 내 상품이 바로 보이게).
  setViewerCacheHeader(res, req.user?.id);

  const productWhere = {
    userId,
    isDeleted: false,
    isHidden: false,
    status: { in: ["판매중", "예약중"] },
  };
  const auctionWhere = { userId, isHidden: false, status: "진행중", endAt: { gt: new Date() } };

  const [products, auctions, productCount, auctionCount] = await Promise.all([
    client.product.findMany({
      where: productWhere,
      select: {
        id: true,
        name: true,
        price: true,
        photos: true,
        mainImage: true,
        status: true,
        dealType: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
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
        _count: { select: { bids: true } },
      },
      orderBy: [{ endAt: "asc" }, { id: "asc" }],
      take: limit,
    }),
    client.product.count({ where: productWhere }),
    client.auction.count({ where: auctionWhere }),
  ]);

  const items: OnSaleItem[] = [
    ...auctions.map((auction) => ({
      kind: "auction" as const,
      id: auction.id,
      title: auction.title,
      currentPrice: auction.currentPrice,
      startPrice: auction.startPrice,
      photo: auction.photos?.[0] ?? null,
      endAt: auction.endAt.toISOString(),
      bidCount: auction._count.bids,
      createdAt: auction.createdAt.toISOString(),
    })),
    ...products.map((product) => ({
      kind: "product" as const,
      id: product.id,
      name: product.name,
      price: product.price,
      photo: product.mainImage || product.photos?.[0] || null,
      status: product.status,
      dealType: product.dealType,
      createdAt: product.createdAt.toISOString(),
    })),
  ].slice(0, limit);

  return res.json({
    success: true,
    items,
    total: { products: productCount, auctions: auctionCount },
  });
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: false }));
