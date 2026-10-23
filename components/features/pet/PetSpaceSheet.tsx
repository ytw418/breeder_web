"use client";

import { useMemo, useState } from "react";
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
 * 사이드 메뉴 맨 위 '지금 공간 · 강아지·고양이 · 바꾸기'(앱 docs/prd/pet-space.md §5.2, 시안 pet-space/A-karrot.html ⑥).
 * 지금 고정이 공간 묶음과 같으면 그 이름, 직접 섞었으면 '내가 고른 분야'. 비로그인도 이 브라우저 고정이 있어 늘 보인다.
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
        <span className="min-w-0 truncate text-[16px] font-bold leading-[22px] text-app-text">{label}</span>
        <span className="shrink-0 text-[13px] font-semibold text-app-brand-text">바꾸기</span>
      </span>
    </button>
  );
}

/**
 * '어떤 공간을 볼까요?' 시트(시안 ⑥). 공간 = 관심 분야 고정 묶음이라 고르면 고정 값을 그 묶음으로 바꾼다
 * (설정 > 관심 카테고리와 같은 값). 행 64(캐릭터 40 r12 · 이름 16/600 · 보조 13 muted · 라디오 22),
 * 맨 아래 '직접 고르기 ›'는 설정 트리 화면. 지금 화면은 그대로 두고 범위만 바뀐다(AC-6) — 단 입양 쪽에 있는데
 * 강아지·고양이가 빠지면 분양 쪽으로 옮긴다. 열 때마다 새로 그린다(부르는 쪽이 열릴 때만 렌더).
 */
export function PetSpaceSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pins } = useCategoryScopeState();
  const { data } = useSWR<CategoriesResponse>(CATEGORIES_KEY, { revalidateOnFocus: false });
  const categories = useMemo(() => (data?.success ? data.categories : []), [data]);
  const current = petSpaceForPaths(pins.map((pin) => pin.path));
  const [choice, setChoice] = useState<PetSpaceId | null>(null);
  const selected = choice ?? current;
  // 카테고리 목록 없이 고정하면 path 를 못 찾아 '전부 보기'가 되어 버린다. 다 받기 전엔 누를 수 없다.
  const ready = categories.length > 0;

  const apply = () => {
    if (!selected || !ready) return;
    if (selected !== current) {
      const space = PET_SPACES.find((item) => item.id === selected);
      const paths = pathsForPetPicks(space?.picks ?? []);
      setPinnedCategories(pinsForPaths(paths, categories));
      markCategoryOnboardingDone();
      trackEvent(ANALYTICS_EVENTS.spaceSwitch, { space: selected, from: current ?? "custom" });
      if (pathname?.startsWith("/adoption") && !hasDogCatPin(paths)) router.replace("/products");
    }
    onClose();
  };

  const openCustom = () => {
    onClose();
    router.push("/settings/categories");
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel="어떤 공간을 볼까요?"
      footer={
        <button
          type="button"
          disabled={!selected || !ready}
          onClick={apply}
          className={cn(
            "h-[52px] w-full rounded-lg text-[16px] font-semibold",
            selected && ready ? "bg-app-brand text-white" : "bg-app-surface text-app-caption"
          )}
        >
          이 공간으로 보기
        </button>
      }
      footerClassName="px-4 pb-6 pt-4"
    >
      <div className="px-4">
        <h2 className="text-[20px] font-bold leading-7 tracking-[-0.5px] text-app-text">어떤 공간을 볼까요?</h2>
        <p className="mt-1 break-keep text-[14px] leading-5 text-app-muted">
          고른 공간의 글과 분양을 먼저 보여 드려요. 하단 탭은 그대로예요.
        </p>
        <div className="mt-3" role="radiogroup" aria-label="공간">
          {PET_SPACES.map((space) => {
            const on = selected === space.id;
            return (
              <button
                key={space.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(space.id)}
                className="flex h-16 w-full items-center gap-3 border-b border-app-surface text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-app-surface">
                  <PetCharacter art={space.art} size={32} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold leading-[22px] text-app-text">
                    {space.label}
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
