"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { QueryErrorState } from "@components/app/QueryErrorState";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import {
  markCategoryOnboardingDone,
  pinsForPaths,
  setPinnedCategories,
  useCategoryScopeState,
  type PinnedCategory,
} from "@libs/client/categoryScope";
import { cn } from "@libs/client/utils";
import type { CategoriesResponse } from "@libs/shared/categories";
import {
  PET_PICK_GRID_CARDS,
  PET_PICK_NONE_CARD,
  pathsForPetPicks,
  petPicksForPaths,
  togglePetPick,
  type PetPickId,
} from "@libs/shared/petSpace";
import { CATEGORIES_KEY } from "@/hooks/useCategoryScope";
import { PetCharacter } from "./PetCharacter";

function CheckMark() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 12.5 4 4 8-9" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 고른 카드의 체크 원 22. 카드는 오른쪽 위, '아직 없어요' 넓은 줄은 세로 가운데.
 * 고르기 전엔 빈 동그라미를 그리지 않는다(토스 리뷰 시안 ① — 빈 원 8개가 고르는 일보다 먼저 보였다).
 */
function PickCheck({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute grid h-[22px] w-[22px] place-items-center rounded-full bg-app-brand", className)}
    >
      <CheckMark />
    </span>
  );
}

/**
 * 첫 질문 "어떤 아이를 키우시나요?"(앱 docs/prd/pet-space.md §4, 시안 pet-space/A-karrot.html ①).
 * 2×4 카드(높이 112 r12, 캐릭터 50, 이름 16/600, 보조 12 muted 한 줄, 고른 카드만 오른쪽 위 체크 22), 여러 개 선택.
 * 높이는 모든 카드가 같다 — 보조 글이 두 줄로 접히던 칸만 커져 격자가 들쭉날쭉했다(토스 리뷰 시안 ①, pet-space/B-toss.html).
 * '아직 없어요'는 카드 아래 넓은 줄(높이 64, 캐릭터 44, 체크 세로 가운데) — 식물 카드가 따로 생겨 9장이 됐다(§12.2).
 * 이름은 캐릭터 바로 아래에 둔다. 시작 버튼은 스크롤해도 아래에 붙어 있다(시트에선 카드가 화면보다 길다).
 * '아직 없어요'는 다른 카드와 같이 고를 수 없다. 고르면 관심 분야 고정을 그 묶음으로 바꾸고(속은 지금 고정 그대로)
 * 마친 것으로 둔다. '건너뛰기'는 전체 보기. '종까지 자세히 고르기 ›'는 지금 트리 화면(onDetail).
 * 홈 첫 방문 시트(CategoryOnboardingPrompt)와 로그인 직후 /onboarding 이 같이 쓴다. 마친 뒤 어디로 갈지는 부르는 쪽이 정한다(홈).
 */
export function PetPickForm({
  variant = "page",
  onFinish,
  onDetail,
}: {
  variant?: "page" | "sheet";
  onFinish: (pins: PinnedCategory[]) => void;
  onDetail: () => void;
}) {
  const { pins } = useCategoryScopeState();
  const { data, error, mutate } = useSWR<CategoriesResponse>(CATEGORIES_KEY, { revalidateOnFocus: false });
  const categories = useMemo(() => (data?.success ? data.categories : []), [data]);
  // 지금 고정이 있으면(설정에서 다시 연 경우 등) 그 카드를 골라 둔다.
  const [picked, setPicked] = useState<PetPickId[] | null>(null);
  const selected = picked ?? petPicksForPaths(pins.map((pin) => pin.path));
  const [saving, setSaving] = useState(false);
  const sheet = variant === "sheet";
  const loading = !data && !error;

  const finish = (ids: PetPickId[]) => {
    if (saving) return;
    setSaving(true);
    const next = pinsForPaths(pathsForPetPicks(ids), categories);
    setPinnedCategories(next);
    markCategoryOnboardingDone();
    trackEvent(ANALYTICS_EVENTS.onboardingPetPick, { kinds: ids.length ? ids.join(",") : "skip" });
    onFinish(next);
  };

  const count = selected.filter((id) => id !== "none").length;
  const noneOn = selected.includes("none");
  const ctaLabel =
    selected.length === 0 ? "키우는 아이를 골라 주세요" : count === 0 ? "다 둘러볼게요" : `${count}개 고르고 시작하기`;
  const ctaOff = selected.length === 0 || saving || loading;

  return (
    <div
      className={cn(
        "relative flex flex-col px-4",
        sheet ? "bg-app-elevated" : "min-h-[100dvh] bg-app-bg pt-6"
      )}
    >
      <button
        type="button"
        disabled={saving}
        onClick={() => finish([])}
        className={cn("absolute right-2 h-11 px-2 text-[15px] text-app-muted", sheet ? "-top-2" : "top-3")}
      >
        건너뛰기
      </button>
      <h2
        className={cn(
          "app-t-question break-keep",
          sheet ? "mt-6" : "mt-10"
        )}
      >
        어떤 아이를 키우시나요?
      </h2>
      <p className="mt-2 break-keep text-[15px] leading-[22px] text-app-muted">
        고른 아이들 소식을 먼저 보여 드려요. 여러 개 골라도 돼요.
      </p>

      {error && !data ? (
        <QueryErrorState onRetry={() => void mutate()} />
      ) : (
        <div className="mt-6" role="group" aria-label="키우는 아이">
          <div className="grid grid-cols-2 gap-2">
            {PET_PICK_GRID_CARDS.map((card) => {
              const on = selected.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={saving}
                  onClick={() => setPicked(togglePetPick(selected, card.id))}
                  className={cn(
                    "relative flex min-h-[112px] flex-col justify-start rounded-xl pb-2 pl-3.5 pr-3 pt-2.5 text-left transition-colors",
                    on ? "bg-app-brand-surface ring-[1.5px] ring-inset ring-app-brand" : "bg-app-gap"
                  )}
                >
                  <PetCharacter art={card.art} size={50} className="-ml-[3px] shrink-0" />
                  <span className="mt-1 block w-full min-w-0">
                    <span className="block text-[16px] font-semibold leading-[22px] text-app-text">{card.label}</span>
                    {card.sub ? (
                      <span className="mt-0.5 block truncate text-[12px] leading-4 text-app-muted">{card.sub}</span>
                    ) : null}
                  </span>
                  {on ? <PickCheck className="right-3 top-3" /> : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            role="checkbox"
            aria-checked={noneOn}
            disabled={saving}
            onClick={() => setPicked(togglePetPick(selected, PET_PICK_NONE_CARD.id))}
            className={cn(
              "relative mt-2 flex min-h-[64px] w-full items-center gap-2 rounded-xl py-2.5 pl-2.5 pr-12 text-left transition-colors",
              noneOn ? "bg-app-brand-surface ring-[1.5px] ring-inset ring-app-brand" : "bg-app-gap"
            )}
          >
            <PetCharacter art={PET_PICK_NONE_CARD.art} size={44} className="shrink-0" />
            <span className="block min-w-0">
              <span className="block text-[16px] font-semibold leading-[22px] text-app-text">
                {PET_PICK_NONE_CARD.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-4 text-app-muted">{PET_PICK_NONE_CARD.sub}</span>
            </span>
            {noneOn ? <PickCheck className="right-3 top-1/2 -translate-y-1/2" /> : null}
          </button>
        </div>
      )}

      {/* 보이는 36 + 위아래 4 = 터치 44(2026-10-23 코덱스 디자인 리뷰). */}
      <button
        type="button"
        onClick={onDetail}
        disabled={saving}
        className="relative mx-auto mt-4 h-9 px-2 text-[13px] text-app-muted after:absolute after:inset-x-0 after:-inset-y-1"
      >
        종까지 자세히 고르기 ›
      </button>

      <div
        className={cn(
          "sticky bottom-0 -mx-4 mt-auto px-4 pt-3",
          sheet ? "bg-app-elevated pb-3" : "bg-app-bg pb-[calc(24px+env(safe-area-inset-bottom))]"
        )}
      >
        <button
          type="button"
          disabled={ctaOff}
          onClick={() => finish(selected)}
          className={cn(
            "h-[52px] w-full rounded-lg text-[16px] font-semibold",
            ctaOff ? "bg-app-surface text-app-caption" : "bg-app-brand text-white"
          )}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

export default PetPickForm;
