import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { CANCELLED_TRADE_STATUS } from "@libs/server/trade";
import type { TradeBuyerSource } from "@libs/shared/tradeReview";

interface Sale {
  id: number;
  userId: number;
  productId: number;
  createdAt: Date;
  /**
   * 본인이 볼 때만: 분양자가 지정한 입양자(탈퇴·없으면 null), 'bredy'|'external'|null, 그 입양자가 입양 확정했는지.
   * 다른 사람에게는 입양자 칸을 내려주지 않는다(앱 docs/prd/trade-review.md §4 C).
   */
  buyer?: { id: number; name: string; avatar: string | null } | null;
  buyerSource?: TradeBuyerSource | null;
  purchaseConfirmed?: boolean;
  product: {
    id: number;
    name: string;
    price: number | null;
    description: string;
    photos: string[];
    createdAt: Date;
    /** 판매자가 삭제했거나 관리자가 숨긴 상품. 기록 당사자(본인)에게만 내려간다. */
    isDeleted: boolean;
    isHidden: boolean;
    _count: {
      favs: number;
    };
  };
}

/**
 * 판매·구매내역 where. 본인에게는 삭제·숨김 상품도 기록으로 남기고,
 * 다른 사람(비로그인 포함)에게는 빼고 준다. 분양완료를 되돌린 기록(cancelled)은 누구에게도 보이지 않는다.
 */
export const historyWhere = (profileId: number, viewerId?: number) => ({
  userId: profileId,
  status: { not: CANCELLED_TRADE_STATUS },
  ...(viewerId === profileId ? {} : { product: { isDeleted: false, isHidden: false } }),
});

export interface MySellHistoryResponseType {
  success: boolean;
  mySellHistoryData: Sale[];
}

type SaleRow = Omit<Sale, "buyer" | "buyerSource" | "purchaseConfirmed"> & {
  buyerId?: number | null;
  buyerSource?: string | null;
  buyerAssignedAt?: Date | null;
};

/** 본인 분양내역 행에 입양자·입양 확정을 붙인다(입양자·확정은 한 번씩 일괄 조회). */
async function withBuyerRows(rows: SaleRow[]): Promise<Sale[]> {
  const assigned = rows.filter((row) => row.buyerSource === "bredy" && typeof row.buyerId === "number");
  const buyerIds = Array.from(new Set(assigned.map((row) => row.buyerId as number)));
  const [users, purchases] = buyerIds.length
    ? await Promise.all([
        client.user.findMany({
          where: { id: { in: buyerIds } },
          select: { id: true, name: true, avatar: true },
        }),
        client.purchase.findMany({
          where: {
            productId: { in: assigned.map((row) => row.productId) },
            userId: { in: buyerIds },
            status: { not: CANCELLED_TRADE_STATUS },
          },
          select: { productId: true, userId: true },
        }),
      ])
    : [[], []];
  const userById = new Map(users.map((user) => [user.id, user]));
  const confirmed = new Set(purchases.map((row) => `${row.productId}:${row.userId}`));
  return rows.map(({ buyerId, buyerSource, buyerAssignedAt: _assignedAt, ...row }) => {
    const source: TradeBuyerSource | null =
      buyerSource === "external" ? "external" : buyerSource === "bredy" && typeof buyerId === "number" ? "bredy" : null;
    const user = source === "bredy" ? userById.get(buyerId as number) : undefined;
    return {
      ...row,
      buyer: user ? { id: user.id, name: user.name, avatar: user.avatar ?? null } : null,
      buyerSource: source,
      purchaseConfirmed: source === "bredy" && confirmed.has(`${row.productId}:${buyerId}`),
    };
  });
}

/** 다른 사람에게는 입양자 칸(누구에게 분양했는지)을 빼고 준다. */
const withoutBuyer = ({ buyerId: _buyerId, buyerSource: _source, buyerAssignedAt: _at, ...row }: SaleRow): Sale => row;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType>
) {
  const {
    query: { id },
  } = req;
  const profileId = Number(id);

  const rows: SaleRow[] = await client.sale.findMany({
    where: historyWhere(profileId, req.user?.id),
    include: {
      product: {
        include: {
          _count: {
            select: {
              favs: true,
            },
          },
        },
      },
    },
  });
  const isOwner = req.user?.id === profileId;
  res.json({
    success: true,
    mySellHistoryData: isOwner ? await withBuyerRows(rows) : rows.map(withoutBuyer),
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
