"use client";
/**
 * 분양 탭 '무료 분양' 섹션(docs/prd/home-ia.md S-2 4번, 앱 components/features/product/FreeGiveawaySection.tsx 와 같다).
 * 옛 홈 2x2 의 무료 분양 칸을 옮겼다(2026-10-15 '무료 분양' → '무료 분양').
 * 분양중인 0원 분양글 최신 10개를 120 카드 레일로. 0건이면 등록 권유 카드(2026-10-09 사용자
 * "왜 사라졌냐, 다시 넣어줘" — 비어도 숨기지 않는다). 조회 오류면 섹션을 그리지 않는다.
 */
import Link from "next/link";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { freeGiveawayEmptyCopy } from "@libs/shared/communityCopy";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import useBlocks from "hooks/useBlocks";

export const FREE_GIVEAWAY_LIMIT = 10;

export default function FreeGiveawaySection({
  category,
  categoryPath,
  onShowAll,
}: {
  /** 고른 대분류·소분류 이름(분양 탭 칩). */
  category?: string;
  /** 관심 카테고리 고정 범위. */
  categoryPath?: string;
  /** '전체 보기': 분양 탭 목록을 무료 분양(0원 · 분양중)으로 거른다. */
  onShowAll: () => void;
}) {
  const { blockedIds } = useBlocks();
  const search = new URLSearchParams({
    page: "1",
    size: String(FREE_GIVEAWAY_LIMIT),
    status: "판매중",
    price: "0",
  });
  if (category) search.set("category", category);
  if (categoryPath) search.set("categoryPath", categoryPath);
  const { data, error } = useSWR<ProductsResponse>(`/api/products?${search.toString()}`, {
    revalidateOnFocus: false,
  });
  if (error && !data) return null;
  const items = withoutBlocked(data?.products ?? [], blockedIds, (product) => product.userId);
  const loading = !data;
  const copy = freeGiveawayEmptyCopy();

  return (
    <section className="pb-3 pt-5" aria-label="무료 분양" data-testid="free-giveaway-section">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="app-t-section">무료 분양</h2>
        {items.length > 0 ? (
          <button type="button" onClick={onShowAll} className="flex items-center gap-0.5 text-[13px] text-app-muted">
            전체 보기
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ) : null}
      </div>
      {!loading && items.length === 0 ? (
        // 0건: 첫 무료 분양 보상 + 행동(community-vibe §3.1). 누르면 무료 분양을 고른 등록 화면.
        <Link
          href="/products/upload?free=1"
          aria-label={`무료 분양, ${copy.title}, ${copy.action}`}
          className="mx-4 block rounded-2xl bg-app-gap p-4"
        >
          <span className="block break-keep text-[15px] font-bold leading-5 text-app-text">{copy.title}</span>
          <span className="mt-1 inline-flex items-center gap-0.5 text-[13px] font-semibold leading-[18px] text-app-brand">
            {copy.action}
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </Link>
      ) : (
        <HorizontalRail label="무료 분양 목록" className="gap-2 px-4">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="w-[120px] shrink-0" aria-hidden="true">
                  <div className="h-[120px] w-[120px] animate-pulse rounded-xl bg-app-placeholder" />
                  <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
                </div>
              ))
            : items.map((item) => (
                <Link
                  key={item.id}
                  href={getProductPath(item.id, item.name)}
                  className="w-[120px] shrink-0 transition-transform active:scale-[0.98]"
                >
                  <span className="relative block h-[120px] w-[120px] overflow-hidden rounded-xl bg-app-placeholder">
                    {item.photos?.[0] ? (
                      <Image
                        src={makeImageUrl(item.photos[0], "product")}
                        alt={item.name}
                        width={120}
                        height={120}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="mt-1.5 block truncate text-[14px] font-medium leading-5 text-app-text">{item.name}</span>
                  <span className="block truncate text-[13px] leading-[18px] text-app-muted">
                    {item.user?.name ?? "무료 분양"}
                  </span>
                </Link>
              ))}
        </HorizontalRail>
      )}
    </section>
  );
}
