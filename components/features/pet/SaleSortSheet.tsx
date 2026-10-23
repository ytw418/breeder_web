"use client";

import { useState } from "react";

import BottomSheet from "@components/app/BottomSheet";
import { cn } from "@libs/client/utils";

/**
 * 강아지·고양이만 고정한 분양 쪽 정렬 시트(토스 리뷰 시안 ③, 앱 docs/prd/pet-space.md §5.3·design/mockups/pet-space/B-toss.html).
 * 종 칩 줄 오른쪽 끝 '최신순 ⌄'이 연다. 정렬 줄 56(고른 줄 16/600 + 주황 체크 22) → 1px 구분선 → '분양중인 글만 보기' 체크 56
 * → '적용하기'. 칩 줄 아래 따로 있던 정렬·'분양중만' 줄을 이 시트 하나로 합쳤다. 고른 값은 '적용하기'를 눌러야 목록에 들어가고,
 * 그냥 닫으면 버린다(열 때마다 지금 값에서 시작한다 — 부르는 쪽이 열릴 때만 그린다). 앱 src/components/features/pet/SaleSortSheet.tsx 와 같다.
 */
export function SaleSortSheet({
  options,
  sort,
  onSaleOnly,
  onApply,
  onClose,
}: {
  options: readonly { value: string; label: string }[];
  sort: string;
  onSaleOnly: boolean;
  onApply: (next: { sort: string; onSaleOnly: boolean }) => void;
  onClose: () => void;
}) {
  const [draftSort, setDraftSort] = useState(sort);
  const [draftOnSale, setDraftOnSale] = useState(onSaleOnly);

  return (
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel="정렬"
      footer={
        <button
          type="button"
          onClick={() => {
            onApply({ sort: draftSort, onSaleOnly: draftOnSale });
            onClose();
          }}
          className="h-[52px] w-full rounded-lg bg-app-brand text-[16px] font-semibold text-white"
        >
          적용하기
        </button>
      }
    >
      <div className="px-4">
        <h2 className="text-[20px] font-bold leading-7 tracking-[-0.5px] text-app-text">정렬</h2>
        <div role="radiogroup" aria-label="정렬 기준" className="mt-2">
          {options.map((option) => {
            const on = draftSort === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDraftSort(option.value)}
                className={cn(
                  "flex h-14 w-full items-center justify-between text-left text-[16px] leading-[22px] text-app-text",
                  on ? "font-semibold" : "font-normal"
                )}
              >
                {option.label}
                {on ? (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-app-brand">
                    <path d="m6 12.5 4 4 8-9" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="my-2 h-px bg-app-line" />
        {/* 체크 상자는 직접 그린다(브라우저 기본 체크는 다크에서 표시가 묻힌다). 앱과 같은 22 r6, 켜면 주황 채움. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={draftOnSale}
          onClick={() => setDraftOnSale((prev) => !prev)}
          className="flex h-14 w-full items-center gap-2.5 text-left text-[16px] leading-[22px] text-app-text"
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-lg border-[1.5px]",
              draftOnSale ? "border-app-brand bg-app-brand text-white" : "border-app-caption"
            )}
          >
            {draftOnSale ? (
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path d="m6 12.5 4 4 8-9" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </span>
          분양중인 글만 보기
        </button>
      </div>
    </BottomSheet>
  );
}

export default SaleSortSheet;
