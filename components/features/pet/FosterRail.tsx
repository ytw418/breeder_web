"use client";

import Link from "next/link";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import { fosterPeriodLabel, fosterSupportLabel, parsePetInfo, petPostPlace } from "@libs/shared/petSpace";
import useBlocks from "hooks/useBlocks";

export const FOSTER_RAIL_LIMIT = 10;

/**
 * 입양 쪽 맨 위 '임보해 주실 분 찾아요' 가로 레일(앱 docs/prd/pet-space.md §5.4, 시안 pet-space/B-toss.html ③).
 * 분양중인 임보 구해요 글 최신 10개, 카드 148(사진 r8 + 왼쪽 위 기간 딱지 22 · 제목 15/600 · 동네(시·군·구, §5.9)·지원 13 muted).
 * 카드를 누르면 상세로 간다(거기 주 버튼 '임보 문의하기'). 카드마다 달던 '임보 문의하기' 버튼은 뺐다 — 한 화면에 같은 버튼이
 * 세 번 보였다(토스 리뷰 결정 C, 2026-10-24 사용자 선택).
 * 0개거나 조회 오류면 섹션을 그리지 않는다(아래 8 갭까지). '전체 ›'는 임보 구해요 전체 목록(/adoption/foster).
 */
export default function FosterRail({
  categoryPath,
  onShowAll,
}: {
  /** 강아지·고양이 범위(adoptionScopePaths 를 쉼표로). */
  categoryPath: string;
  onShowAll: () => void;
}) {
  const { blockedIds } = useBlocks();
  const search = new URLSearchParams({
    page: "1",
    size: String(FOSTER_RAIL_LIMIT),
    dealType: "foster",
    status: "판매중",
    categoryPath,
  });
  const { data, error } = useSWR<ProductsResponse>(`/api/products?${search.toString()}`, {
    revalidateOnFocus: false,
  });
  if (error && !data) return null;
  const items = withoutBlocked(data?.products ?? [], blockedIds, (product) => product.userId);
  const loading = !data;
  if (!loading && items.length === 0) return null;

  return (
    <section className="pt-5" aria-label="임보해 주실 분 찾아요" data-testid="foster-rail">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="text-[16px] font-bold leading-[22px] text-app-text">임보해 주실 분 찾아요</h2>
        {items.length > 0 ? (
          <button type="button" onClick={onShowAll} className="text-[13px] text-app-muted">
            전체 ›
          </button>
        ) : null}
      </div>
      <HorizontalRail label="임보 구해요 목록" className="gap-2 px-4">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="w-[148px] shrink-0" aria-hidden="true">
                <div className="h-[148px] w-[148px] animate-pulse rounded-lg bg-app-placeholder" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
                <div className="mt-1.5 h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
              </div>
            ))
          : items.map((item) => {
              const info = parsePetInfo(item.petInfo);
              const period = fosterPeriodLabel(info);
              const meta = [petPostPlace(item), fosterSupportLabel(info)].filter(Boolean).join(" · ");
              return (
                <div key={item.id} className="w-[148px] shrink-0">
                  <Link href={getProductPath(item.id, item.name)} className="block">
                    <span className="relative block h-[148px] w-[148px] overflow-hidden rounded-lg bg-app-placeholder">
                      {item.photos?.[0] ? (
                        <Image
                          src={makeImageUrl(item.photos[0], "product")}
                          alt={item.name}
                          width={148}
                          height={148}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // 사진 없는 글은 가운데 그림 아이콘(앱 FosterCard·ProductCard 와 같다).
                        <span className="grid h-full w-full place-items-center text-app-caption" aria-hidden="true">
                          <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </span>
                      )}
                      {period ? (
                        <span className="absolute left-1.5 top-1.5 h-[22px] max-w-[136px] truncate rounded bg-app-inverse px-[7px] text-[12px] font-semibold leading-[22px] text-app-inverse-text">
                          {period}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block truncate text-[15px] font-semibold leading-[22px] text-app-text">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-app-muted">
                      {meta || item.user?.name || "임보 구해요"}
                    </span>
                  </Link>
                </div>
              );
            })}
      </HorizontalRail>
      {/* 아래 '가족을 기다려요'와 가르는 8 갭. 레일이 숨으면 같이 숨는다(칩 바로 아래 빈 띠가 남지 않게). */}
      <div className="mt-5 h-2 bg-app-gap" aria-hidden="true" />
    </section>
  );
}
