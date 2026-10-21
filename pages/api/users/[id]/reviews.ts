import type { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { excludedAuthorIds, setViewerCacheHeader } from "@libs/server/blocks";
import { parsePositiveIntId } from "@libs/shared/normalize";
import { countReviewKeywords, toPublicTradeReview, tradeReviewSelect } from "@libs/server/tradeReview";
import type { UserTradeReviewItem, UserTradeReviewsResponse } from "@libs/shared/tradeReview";

/**
 * GET /api/users/:id/reviews?page=1&size=20 — 받은 거래 후기(앱 docs/prd/trade-review.md §4 C, 화면 /profiles/:id/reviews).
 * 공개. 운영자가 숨긴 후기·숨긴 분양글의 후기·옛 Review 행(productId 없음)은 빼고, 보는 사람이 차단한 작성자의 후기도 뺀다.
 * 지운 분양글의 후기는 남기되 분양글은 이름·사진 없이 removed 로 준다. 키워드 집계는 이 조건의 전체 후기 기준.
 */

const DEFAULT_SIZE = 20;
const MAX_SIZE = 50;

const pageParam = (value: unknown, fallback: number, max: number) => {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

async function handler(req: NextApiRequest, res: NextApiResponse<UserTradeReviewsResponse | { success: false; message: string }>) {
  const userId = parsePositiveIntId(req.query.id);
  if (!userId) return res.status(404).json({ success: false, message: "유저를 찾을 수 없습니다." });
  const viewerId = req.user?.id;
  setViewerCacheHeader(res, viewerId);

  const page = pageParam(req.query.page, 1, 10_000);
  const size = pageParam(req.query.size, DEFAULT_SIZE, MAX_SIZE);
  const excluded = await excludedAuthorIds(viewerId);
  const where = {
    createdForId: userId,
    isHidden: false,
    productId: { not: null },
    product: { isHidden: false },
    ...(excluded.length ? { createdById: { notIn: excluded } } : {}),
  };

  const [total, rows, keywordRows] = await Promise.all([
    client.review.count({ where }),
    client.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * size,
      take: size,
      select: {
        ...tradeReviewSelect,
        product: { select: { id: true, name: true, photos: true, isDeleted: true } },
      },
    }),
    client.review.findMany({ where, select: { keywords: true } }),
  ]);

  const items: UserTradeReviewItem[] = rows.map(({ product, ...row }) => ({
    ...toPublicTradeReview(row),
    product: !product
      ? { id: row.productId ?? 0, removed: true }
      : product.isDeleted
        ? { id: product.id, removed: true }
        : { id: product.id, name: product.name, image: product.photos?.[0] ?? null },
  }));

  return res.json({ success: true, total, items, keywordCounts: countReviewKeywords(keywordRows) });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
