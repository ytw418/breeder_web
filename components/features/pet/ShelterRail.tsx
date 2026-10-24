"use client";

import Link from "next/link";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import { PET_SEX_OPTIONS, parsePetInfo, petPostPlace } from "@libs/shared/petSpace";
import { shelterDeadlineLabel } from "@libs/shared/shelterNotice";
import useBlocks from "hooks/useBlocks";

export const SHELTER_RAIL_LIMIT = 10;

/**
 * 카드 둘째 줄 "시군구 · 성별 · 나이"(시안 shelter-animals/A-karrot.html #shelter-rail). 빈 값은 뺀다.
 * 시군구는 petPostPlace(강아지·고양이 가족 찾아요 글), 성별 '몰라요'는 뺀다.
 */
export function shelterCardMeta(item: {
  category?: string | null;
  dealType?: string | null;
  petInfo?: unknown;
  regionSido?: string | null;
  regionSigungu?: string | null;
}): string {
  const info = parsePetInfo(item.petInfo);
  const sex = info?.sex && info.sex !== "unknown" ? PET_SEX_OPTIONS.find((option) => option.id === info.sex)?.label : null;
  return [petPostPlace(item), sex, info?.age].filter(Boolean).join(" · ");
}

/**
 * 입양 쪽 '보호소에서 기다려요' 가로 레일(앱 docs/prd/shelter-animals.md S-1, 시안 shelter-animals/A-karrot.html #shelter-rail).
 * 국가동물보호정보시스템 공고를 옮겨 온 글(GET /api/products?source=shelter — 서버가 내 시/도 공고를 앞에 둔다) 최대 10장.
 * 카드 148(임보 레일과 같은 크기): 사진 + 왼쪽 위 '보호소' 딱지(목록 썸네일 딱지와 같은 면 색), 제목, 시군구 · 성별 · 나이.
 * 0개거나 조회 오류면 섹션을 그리지 않는다(아래 8 갭까지). '전체 ›'는 보호소 아이들 전체 목록(/adoption/shelter).
 * 셋째 줄 '공고 D-3'은 본문의 공고 마감일에서 센다(shelterDeadlineLabel — 줄이 없거나 이미 지났으면 그리지 않는다).
 */
export default function ShelterRail({
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
    size: String(SHELTER_RAIL_LIMIT),
    source: "shelter",
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
    <section className="pt-5" aria-label="보호소에서 기다려요" data-testid="shelter-rail">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="text-[16px] font-bold leading-[22px] text-app-text">보호소에서 기다려요</h2>
        {items.length > 0 ? (
          <button type="button" onClick={onShowAll} className="text-[13px] text-app-muted">
            전체 ›
          </button>
        ) : null}
      </div>
      <HorizontalRail label="보호소 아이들 목록" className="gap-2 px-4">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="w-[148px] shrink-0" aria-hidden="true">
                <div className="h-[148px] w-[148px] animate-pulse rounded-lg bg-app-placeholder" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
                <div className="mt-1.5 h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
              </div>
            ))
          : items.map((item) => {
              const meta = shelterCardMeta(item);
              const deadline = shelterDeadlineLabel(item.description);
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
                        // 사진 없는 글은 가운데 그림 아이콘(임보 레일·ProductCard 와 같다).
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
                      <span className="absolute left-1.5 top-1.5 h-5 rounded bg-app-elevated px-1.5 text-[12px] font-semibold leading-5 text-app-text">
                        보호소
                      </span>
                    </span>
                    <span className="mt-2 block truncate text-[15px] font-semibold leading-[22px] text-app-text">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-app-muted">
                      {meta || item.category || "보호소"}
                    </span>
                    {deadline ? (
                      <span className="mt-0.5 block truncate text-[13px] font-semibold leading-[18px] text-app-text">
                        {deadline}
                      </span>
                    ) : null}
                  </Link>
                </div>
              );
            })}
      </HorizontalRail>
      {/* 아래 '가족을 기다려요'와 가르는 8 갭. 레일이 숨으면 같이 숨는다. */}
      <div className="mt-5 h-2 bg-app-gap" aria-hidden="true" />
    </section>
  );
}
