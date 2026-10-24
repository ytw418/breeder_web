"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import FloatingButton, { FAB_LIST_BOTTOM_PADDING_CLASS } from "@components/atoms/floating-button";
import FosterRail from "@components/features/pet/FosterRail";
import ShelterRail from "@components/features/pet/ShelterRail";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ProductCard } from "@components/app/ProductCard";
import CoupangBanner from "@components/app/ads/CoupangBanner";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { getCoupangWebConfig } from "@libs/client/adsConfig";
import { withAdRows } from "@libs/shared/ads/adRows";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import {
  ADOPTION_CHIP_LABELS,
  adoptionChipPath,
  adoptionChips,
  adoptionScopePaths,
  adoptionWriteSpecies,
  fosterListHref,
  isAdoptionChip,
  shelterListHref,
  type AdoptionChip,
} from "@libs/shared/petSpace";
import { shelterDeadlineLabel } from "@libs/shared/shelterNotice";
import { uniqueById } from "@libs/productFilters";
import useBlocks from "hooks/useBlocks";
import useCategoryScope from "hooks/useCategoryScope";
import { ProductRowSkeleton } from "../products/_components/ProductRowSkeleton";

/** 입양 쪽엔 AdSense·AdMob 을 두지 않고 쿠팡만(docs/prd/pet-space.md §7, ads.md §10 생물 거래 화면). */
const ADOPTION_ADS_ENABLED = Boolean(getCoupangWebConfig());
const PAGE_SIZE = 12;

const EMPTY_COPY: Record<"foster" | "rehoming", { title: string; body: string; action: string }> = {
  foster: {
    title: "아직 임보 구하는 글이 없어요",
    body: "잠시 맡아 줄 분(임시보호)이 필요한 아이가 있다면 글을 올려 주세요.",
    action: "임보 구하는 글 쓰기",
  },
  rehoming: {
    title: "아직 가족을 기다리는 아이가 없어요",
    body: "구조했거나 사정이 생겨 새 가족을 찾는 아이가 있다면 글을 올려 주세요.",
    action: "가족 찾는 글 쓰기",
  },
};

/**
 * 입양 쪽 목록(앱 src/components/features/pet/AdoptionList.tsx, 앱 docs/prd/pet-space.md §5.4, 시안 pet-space/B-toss.html ③).
 * 입양 쪽 첫 화면(/adoption)과 임보 구해요 전체 목록(/adoption/foster, kind="foster"),
 * 보호소 아이들 전체 목록(/adoption/shelter, kind="shelter", 앱 docs/prd/shelter-animals.md S-2)이 같이 쓴다.
 * 칩은 종만 — 강아지·고양이를 둘 다 고정했으면 '전체 · 강아지 · 고양이', 한 종이면 칩 줄이 없다(토스 리뷰 시안 ④ — 글 종류 칩은
 * 아래 두 섹션이 이미 나눠 보여 줘서 뺐다). 첫 화면은 맨 위 '임보해 주실 분 찾아요' 레일 + 8 갭(0개면 둘 다 숨김) + '가족을 기다려요'
 * (가족 찾아요 글), 레일 '전체 ›'는 /adoption/foster 를 연다(고른 종 칩을 들고 간다). 늘 강아지·고양이 안에서만 찾는다
 * (adoptionScopePaths). 칩은 URL(?chip=)에 적어 상세에 갔다 와도 그대로다. 옛 링크 /adoption?chip=foster 는 임보 목록으로 보낸다.
 * 첫 화면은 임보 레일 아래, '가족을 기다려요' 위에 '보호소에서 기다려요' 레일(ShelterRail, 0개면 숨김)이 한 번 더 있고 '전체 ›'는
 * /adoption/shelter 를 연다. kind="shelter" 는 국가동물보호정보시스템 공고를 옮겨 온 글(source=shelter)만 보여 준다 —
 * 위쪽 안내 한 줄, 글쓰기 버튼 없음(보호소 글은 서버가 쓴다). 회원 목록('가족을 기다려요')에는 서버가 보호소 글을 섞지 않는다.
 */
export default function AdoptionListBody({ kind }: { kind?: "foster" | "shelter" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawChip = searchParams?.get("chip") ?? null;
  const chip: AdoptionChip = isAdoptionChip(rawChip) ? rawChip : "all";
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { blockedIds } = useBlocks();
  const scope = useCategoryScope();
  const scopePaths = useMemo(() => adoptionScopePaths(scope.pins.map((pin) => pin.path)), [scope.pins]);
  const chips = adoptionChips(scopePaths);
  const activeChip = chips.includes(chip) ? chip : "all";
  const categoryPath = adoptionChipPath(scopePaths, activeChip);
  const isShelter = kind === "shelter";
  const listKind: "foster" | "rehoming" = kind === "foster" ? "foster" : "rehoming";
  const withRail = !kind;

  // 글 종류 칩이 있던 때의 공유 링크(?chip=foster)는 임보 구해요 전체 목록으로 보낸다.
  useEffect(() => {
    if (withRail && rawChip === "foster") router.replace(fosterListHref("all"));
  }, [withRail, rawChip, router]);

  // 입양 쪽을 본 횟수(docs/prd/pet-space.md §10). 칩을 바꿀 때마다 세어 어느 칩·목록을 많이 보는지 본다.
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.adoptionSideView, { chip: activeChip, list: withRail ? "overview" : kind });
  }, [activeChip, withRail]);

  const selectChip = (next: AdoptionChip) => {
    if (next === activeChip) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") params.delete("chip");
    else params.set("chip", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname || "/adoption", { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const getKey = (pageIndex: number, previous: ProductsResponse | null) => {
    if (previous && pageIndex >= (previous.pages ?? 0)) return null;
    const search = new URLSearchParams({
      page: String(pageIndex + 1),
      size: String(PAGE_SIZE),
      categoryPath,
    });
    // 보호소 목록은 source=shelter 만(서버가 보호소 글만 돌려주고 내 시/도 공고를 앞에 둔다). 나머지는 글 종류로.
    if (isShelter) search.set("source", "shelter");
    else search.set("dealType", listKind);
    return `/api/products?${search.toString()}`;
  };
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<ProductsResponse>(getKey, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const products = useMemo(
    () =>
      withoutBlocked(
        uniqueById((data ?? []).flatMap((page) => page?.products ?? [])),
        blockedIds,
        (product) => product.userId
      ),
    [data, blockedIds]
  );
  const loadedPages = data?.length ?? 0;
  const totalPages = data?.[loadedPages - 1]?.pages ?? 0;
  const hasMore = loadedPages > 0 && loadedPages < totalPages;
  const firstPageError = Boolean(error) && loadedPages === 0;
  const nextPageError = Boolean(error) && loadedPages > 0;
  const isLoadingMore = isValidating && size > loadedPages && loadedPages > 0;
  const isFirstLoading = !data && !error;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isValidating) {
          void setSize((current) => (current <= loadedPages ? loadedPages + 1 : current));
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, isValidating, loadedPages, setSize]);

  // 종을 알면(종 칩·한 종만 고정) 글쓰기에서 강아지·고양이를 미리 고른다.
  const writeSpecies = adoptionWriteSpecies(scopePaths, activeChip);
  const writeHref = `/products/upload?kind=${listKind}${writeSpecies ? `&category=${encodeURIComponent(writeSpecies)}` : ""}`;
  const empty = EMPTY_COPY[listKind];

  const renderState = () => {
    if (isFirstLoading) return <ProductRowSkeleton count={4} />;
    if (firstPageError) {
      return (
        <QueryErrorState
          title={isShelter ? "보호소 아이들을 불러오지 못했어요" : "입양 목록을 불러오지 못했어요"}
          onRetry={() => void mutate()}
        />
      );
    }
    if (isShelter) {
      // 0건(칩 필터 포함): 종 칩을 골랐으면 '전체'로 돌아가는 길을 둔다. 글쓰기 버튼은 없다.
      return (
        <div className="flex flex-col items-center px-6 py-16 text-center" data-testid="shelter-empty">
          <p className="break-keep text-[16px] font-semibold text-app-text">지금 보호 중인 아이가 없어요</p>
          {activeChip !== "all" ? (
            <button
              type="button"
              onClick={() => selectChip("all")}
              className="mt-4 h-10 rounded-lg bg-app-surface px-4 text-[15px] font-semibold text-app-text"
            >
              전체 보기
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center" data-testid="adoption-empty">
        <p className="break-keep text-[16px] font-semibold text-app-text">{empty.title}</p>
        <p className="mt-1.5 break-keep text-[15px] leading-[22px] text-app-muted">{empty.body}</p>
        <button
          type="button"
          onClick={() => router.push(writeHref)}
          className="mt-4 h-10 rounded-lg bg-app-surface px-4 text-[15px] font-semibold text-app-text"
        >
          {empty.action}
        </button>
      </div>
    );
  };

  return (
    <>
      {chips.length ? (
        <div className="sticky top-14 z-10 border-b border-app-line bg-app-bg">
          <FilterChipRail>
            {chips.map((id) => (
              <FilterChip
                key={id}
                label={ADOPTION_CHIP_LABELS[id]}
                selected={activeChip === id}
                onClick={() => selectChip(id)}
              />
            ))}
          </FilterChipRail>
        </div>
      ) : null}

      {isShelter ? (
        // 위쪽 안내 한 줄(시안 #shelter-list .note): 어디서 옮겨 온 글인지, 문의는 보호소로.
        <div className="mx-4 mb-1 mt-3 flex gap-1.5 rounded-lg bg-app-surface px-3 py-2.5 text-[13px] leading-[18px] text-app-sub">
          <svg className="mt-px h-4 w-4 shrink-0 text-app-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
          </svg>
          <p>국가동물보호정보시스템 공고를 3시간마다 옮겨 와요 · 입양 문의는 보호소로</p>
        </div>
      ) : null}

      {withRail ? (
        <>
          <FosterRail
            key={categoryPath}
            categoryPath={categoryPath}
            onShowAll={() => router.push(fosterListHref(activeChip))}
          />
          <ShelterRail
            key={`shelter-${categoryPath}`}
            categoryPath={categoryPath}
            onShowAll={() => router.push(shelterListHref(activeChip))}
          />
          <h2 className="px-4 pb-1 pt-5 text-[16px] font-bold leading-[22px] text-app-text">가족을 기다려요</h2>
        </>
      ) : null}

      <div className={FAB_LIST_BOTTOM_PADDING_CLASS}>
        {products.length > 0
          ? withAdRows(products, ADOPTION_ADS_ENABLED).map((product) =>
              "kind" in product ? (
                <CoupangBanner key={`ad-${product.slot}`} variant="row" />
              ) : (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.photos?.[0],
                    createdAt: product.createdAt,
                    category: product.category,
                    status: product.status,
                    wishCount: product._count?.favs,
                    viewCount: product.viewCount,
                    photoCount: product.photos?.length ?? 0,
                    sellerId: product.userId,
                    seller: product.user ?? null,
                    dealType: product.dealType,
                    petInfo: product.petInfo,
                    regionSido: product.regionSido,
                    regionSigungu: product.regionSigungu,
                    externalSource: product.externalSource,
                    noticeLabel: product.externalSource ? shelterDeadlineLabel(product.description) : null,
                  }}
                  markUnread
                />
              )
            )
          : renderState()}

        {products.length > 0 ? (
          nextPageError || isLoadingMore ? (
            <RetryFooter loading={isLoadingMore} error={nextPageError} onRetry={() => void setSize(loadedPages + 1)} />
          ) : !hasMore ? (
            <p className="py-6 text-center text-[13px] text-app-muted">모든 글을 봤어요</p>
          ) : null
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>

      {isShelter ? null : (
        <FloatingButton
          href={writeHref}
          label={listKind === "foster" ? "임보 구하는 글 쓰기" : "가족 찾는 글 쓰기"}
          hideOnScroll
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </FloatingButton>
      )}
    </>
  );
}
