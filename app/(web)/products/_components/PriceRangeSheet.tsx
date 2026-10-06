"use client";

import { useState } from "react";
import { BottomSheet } from "@components/app/BottomSheet";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { PriceInput } from "@components/app/PriceInput";
import { PRODUCT_PRICE_MAX } from "@libs/productRules";
import { normalizePriceRange, PRICE_PRESETS } from "@libs/productFilters";

type PriceRange = { minPrice?: number; maxPrice?: number };

/**
 * 상품 목록 가격 필터 시트(앱 PriceRangeSheet). 프리셋 칩 → 최소/최대 입력 → 초기화·적용.
 * 입력은 시트가 열려 있는 동안만 유지된다(BottomSheet 가 닫히면 폼이 언마운트된다).
 */
export function PriceRangeSheet({
  open,
  minPrice,
  maxPrice,
  onApply,
  onClose,
}: {
  open: boolean;
  minPrice?: number;
  maxPrice?: number;
  onApply: (range: PriceRange) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="가격" ariaLabel="가격">
      <PriceRangeForm
        initialMin={minPrice}
        initialMax={maxPrice}
        onApply={(range) => {
          onApply(range);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

function PriceRangeForm({
  initialMin,
  initialMax,
  onApply,
}: {
  initialMin?: number;
  initialMax?: number;
  onApply: (range: PriceRange) => void;
}) {
  const [min, setMin] = useState<number | null>(initialMin ?? null);
  const [max, setMax] = useState<number | null>(initialMax ?? null);

  const selectedPreset = PRICE_PRESETS.find(
    (p) => (p.min ?? null) === min && (p.max ?? null) === max
  );

  return (
    <div className="pb-4">
      <FilterChipRail className="mt-1">
        {PRICE_PRESETS.map((preset) => {
          const selected = selectedPreset === preset;
          return (
            <FilterChip
              key={preset.label}
              label={preset.label}
              selected={selected}
              onClick={() => {
                // 선택된 프리셋을 다시 누르면 입력을 비운다.
                setMin(selected ? null : preset.min ?? null);
                setMax(selected ? null : preset.max ?? null);
              }}
            />
          );
        })}
      </FilterChipRail>

      <div className="mt-3 flex items-center gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <PriceInput
            value={min}
            onChange={setMin}
            max={PRODUCT_PRICE_MAX}
            placeholder="최소"
            aria-label="최소 가격"
            className="min-w-0 flex-1"
          />
          <span className="text-[15px] text-app-text">원</span>
        </div>
        <span className="text-[15px] text-app-muted">~</span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <PriceInput
            value={max}
            onChange={setMax}
            max={PRODUCT_PRICE_MAX}
            placeholder="최대"
            aria-label="최대 가격"
            className="min-w-0 flex-1"
          />
          <span className="text-[15px] text-app-text">원</span>
        </div>
      </div>

      <div className="mt-6 flex gap-2 px-4">
        <button
          type="button"
          aria-label="가격 필터 초기화"
          // 가격 조건을 바로 지우고 닫는다(칩이 "가격"으로 돌아간다).
          onClick={() => onApply({ minPrice: undefined, maxPrice: undefined })}
          className="h-[52px] flex-1 rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
        >
          초기화
        </button>
        <button
          type="button"
          onClick={() => onApply(normalizePriceRange(min, max))}
          className="h-[52px] flex-[2] rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          적용
        </button>
      </div>
    </div>
  );
}

export default PriceRangeSheet;
