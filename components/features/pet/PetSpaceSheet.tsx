"use client";

import { Fragment, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";

import BottomSheet from "@components/app/BottomSheet";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import {
  markCategoryOnboardingDone,
  pinsForPaths,
  setPinnedCategories,
  useCategoryScopeState,
} from "@libs/client/categoryScope";
import { cn } from "@libs/client/utils";
import type { CategoriesResponse } from "@libs/shared/categories";
import {
  PET_SPACES,
  hasDogCatPin,
  pathsForPetPicks,
  petSpaceForPaths,
  petSpaceLabel,
  spaceLabelParts,
  type PetSpaceId,
} from "@libs/shared/petSpace";
import { CATEGORIES_KEY } from "@/hooks/useCategoryScope";
import { PetCharacter } from "./PetCharacter";

/** 화살표 두 개(시안 pet-space i-swap). */
function SwapIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h12l-3-3M17 17H5l3 3" />
    </svg>
  );
}

/**
 * 공간 이름. 길면('소동물·파충류·곤충·물고기·식물') 자르지 않고 '·' 뒤에서만 접는다(감싸는 쪽이 break-keep).
 * 사이드 메뉴 카드와 공간 시트 행이 같이 쓴다 — 시트에서 한 줄로 자르면 고른 범위가 안 보였다(2026-10-23 코덱스 디자인 리뷰).
 */
function SpaceName({ label }: { label: string }) {
  return (
    <>
      {spaceLabelParts(label).map((part, index) => (
        <Fragment key={index}>
          {index ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * 사이드 메뉴 맨 위 '지금 공간 · 강아지·고양이 · 바꾸기'(앱 docs/prd/pet-space.md §5.2, 시안 pet-space/A-karrot.html ⑥).
 * 지금 고정이 공간 묶음과 같으면 그 이름, 직접 섞었으면 '내가 고른 분야'. 비로그인도 이 브라우저 고정이 있어 늘 보인다.
 * 이름이 길면('소동물·파충류·곤충·물고기·식물') 자르지 않고 '·' 뒤에서 두 줄로 접는다.
 */
export function PetSpaceCard({ onOpen }: { onOpen: () => void }) {
  const { pins } = useCategoryScopeState();
  const label = petSpaceLabel(pins.map((pin) => pin.path));
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`지금 공간 ${label}, 바꾸기`}
      data-testid="pet-space-card"
      className="mx-5 mb-4 block w-[calc(100%-40px)] rounded-xl bg-app-gap px-3.5 py-3 text-left"
    >
      <span className="block text-[12px] leading-4 text-app-muted">지금 공간</span>
      <span className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 break-keep text-[16px] font-bold leading-[22px] text-app-text">
          <SpaceName label={label} />
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-app-brand-text">바꾸기</span>
      </span>
    </button>
  );
}

/**
 * '어떤 공간을 볼까요?' 시트(시안 ⑥). 공간 = 관심 분야 고정 묶음이라 고르면 고정 값을 그 묶음으로 바꾼다
 * (설정 > 관심 카테고리와 같은 값). 행 64(캐릭터 40 r12 · 이름 16/600 · 보조 13 muted · 라디오 22, 이름이 접히면 늘어난다),
 * 맨 아래 '직접 고르기 ›'는 설정 트리 화면. 줄을 누르면 바로 바뀌고 시트가 닫힌다 — 고른 뒤 '이 공간으로 보기'를 한 번 더
 * 누르던 단계를 뺐다(2026-10-23 토스 디자인 리뷰, 앱 docs/prd/pet-space.md §5.10). 지금 화면은 그대로 두고 범위만
 * 바뀐다(AC-6) — 단 입양 쪽에 있는데 강아지·고양이가 빠지면 분양 쪽으로 옮긴다. 열 때마다 새로 그린다(부르는 쪽이 열릴 때만 렌더).
 */
export function PetSpaceSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pins } = useCategoryScopeState();
  const { data } = useSWR<CategoriesResponse>(CATEGORIES_KEY, { revalidateOnFocus: false });
  const categories = useMemo(() => (data?.success ? data.categories : []), [data]);
  const current = petSpaceForPaths(pins.map((pin) => pin.path));
  // 카테고리 목록 없이 고정하면 path 를 못 찾아 '전부 보기'가 되어 버린다. 다 받기 전엔 누를 수 없다.
  const ready = categories.length > 0;

  const choose = (id: PetSpaceId) => {
    if (!ready) return;
    if (id !== current) {
      const space = PET_SPACES.find((item) => item.id === id);
      const paths = pathsForPetPicks(space?.picks ?? []);
      setPinnedCategories(pinsForPaths(paths, categories));
      markCategoryOnboardingDone();
      trackEvent(ANALYTICS_EVENTS.spaceSwitch, { space: id, from: current ?? "custom" });
      if (pathname?.startsWith("/adoption") && !hasDogCatPin(paths)) router.replace("/products");
    }
    onClose();
  };

  const openCustom = () => {
    onClose();
    router.push("/settings/categories");
  };

  return (
    <BottomSheet open onClose={onClose} ariaLabel="어떤 공간을 볼까요?">
      <div className="px-4 pb-4">
        <h2 className="text-[20px] font-bold leading-7 tracking-[-0.5px] text-app-text">어떤 공간을 볼까요?</h2>
        <p className="mt-1 break-keep text-[15px] leading-[22px] text-app-muted">고른 공간의 글과 분양을 먼저 보여 드려요</p>
        <div className="mt-3" role="radiogroup" aria-label="공간">
          {PET_SPACES.map((space) => {
            const on = current === space.id;
            return (
              <button
                key={space.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!ready}
                // 이름을 '·' 뒤에서 접는 <wbr> 때문에 읽는 이름에 빈칸이 끼지 않게 직접 준다(앱 accessibilityLabel 과 같다).
                aria-label={`${space.label}, ${space.sub}`}
                onClick={() => choose(space.id)}
                className="flex min-h-[64px] w-full items-center gap-3 border-b border-app-surface py-2.5 text-left disabled:opacity-50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-app-surface">
                  <PetCharacter art={space.art} size={32} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-keep text-[16px] font-semibold leading-[22px] text-app-text">
                    <SpaceName label={space.label} />
                  </span>
                  <span className="block truncate text-[13px] leading-[18px] text-app-muted">{space.sub}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-[22px] w-[22px] shrink-0 rounded-full",
                    on ? "border-[6px] border-app-brand" : "border-[1.5px] border-app-caption"
                  )}
                />
              </button>
            );
          })}
          <button type="button" onClick={openCustom} className="flex h-16 w-full items-center gap-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-app-surface text-app-text">
              <SwapIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold leading-[22px] text-app-text">직접 고르기</span>
              <span className="block truncate text-[13px] leading-[18px] text-app-muted">강아지 + 게코처럼 섞어서</span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-[16px] text-app-muted">
              ›
            </span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default PetSpaceSheet;
