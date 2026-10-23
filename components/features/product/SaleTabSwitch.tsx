"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { useCategoryScopeState } from "@libs/client/categoryScope";
import { cn } from "@libs/client/utils";
import type { ProductsResponse } from "@libs/shared/home";
import {
  adoptionScopePaths,
  SALE_TAB_MODE_LABELS,
  saleTabModesShowing,
  type SaleTabMode,
} from "@libs/shared/petSpace";

const HREFS: Record<SaleTabMode, string> = {
  products: "/products",
  auctions: "/auctions",
  adoption: "/adoption",
};

/** 이번 브라우저 세션에서 경매·입양 쪽을 열었는지(sessionStorage). 막혀 있으면 그냥 매번 보인다. */
const OPENED_KEYS: Partial<Record<SaleTabMode, string>> = {
  auctions: "bredy.auctionTabOpened",
  adoption: "bredy.adoptionTabOpened",
};

const readOpened = (mode: SaleTabMode) => {
  const key = OPENED_KEYS[mode];
  if (!key) return true;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * 분양 탭 맨 위 밑줄 탭(앱 docs/prd/home-v2.md S-2, docs/prd/pet-space.md §5.1, 시안 pet-space/A-karrot.html ②④).
 * 높이 48, 같은 너비. 선택 16/700 text + 2px 밑줄, 비선택 16/500 muted. 웹은 /products · /auctions · /adoption 링크다
 * (앱은 한 탭 안에서 ?mode= 로 바꾼다). 칸은 관심 분야 고정으로 정한다(saleTabModes):
 * 파충류 쪽·전체 보기는 '분양 | 경매'(지금 그대로), 강아지·고양이만이면 '분양 | 입양', 섞으면 '분양 | 경매 | 입양',
 * 소동물만이면 한 칸이라 줄을 그리지 않는다.
 * 이번 브라우저 세션에서 경매를 아직 안 열었으면 '경매' 옆에 빨간 'N'(2026-10-22 사용자 "클릭 유도"),
 * 입양 쪽을 안 열었으면 '입양' 옆에 분양중인 임보 구해요 글 수(0이면 없음). 앱은 실행마다.
 */
export default function SaleTabSwitch({ active }: { active: SaleTabMode }) {
  const { pins } = useCategoryScopeState();
  const paths = useMemo(() => pins.map((pin) => pin.path), [pins]);
  // 공유 링크로 입양 쪽을 열었는데 강아지·고양이를 고정하지 않았으면 '입양' 칸을 붙여 지금 쪽을 보인다.
  const modes = useMemo(() => saleTabModesShowing(paths, active), [paths, active]);
  // 서버 렌더와 맞추려고 처음엔 숨기고, 붙은 뒤 세션 기록을 읽는다.
  const [opened, setOpened] = useState<Record<string, boolean>>({ auctions: true, adoption: true });
  useEffect(() => {
    const key = OPENED_KEYS[active];
    if (key) {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        // 저장이 막혀도 이번 화면에서는 그 쪽을 보고 있다.
      }
    }
    setOpened({ auctions: readOpened("auctions"), adoption: readOpened("adoption") });
  }, [active]);

  const showFosterCount = modes.includes("adoption") && active !== "adoption" && !opened.adoption;
  const fosterSearch = new URLSearchParams({
    page: "1",
    size: "1",
    dealType: "foster",
    status: "판매중",
    categoryPath: adoptionScopePaths(paths).join(","),
  });
  const { data: fosterData } = useSWR<ProductsResponse>(
    showFosterCount ? `/api/products?${fosterSearch.toString()}` : null,
    { revalidateOnFocus: false }
  );
  const fosterCount = showFosterCount ? fosterData?.total ?? 0 : 0;

  if (modes.length < 2) return null;
  return (
    <nav
      aria-label={modes.map((mode) => SALE_TAB_MODE_LABELS[mode]).join(" · ")}
      className="flex h-12 border-b border-app-line bg-app-bg"
    >
      {modes.map((mode) => {
        const selected = mode === active;
        const showNew = mode === "auctions" && !selected && !opened.auctions;
        const count = mode === "adoption" && !selected ? fosterCount : 0;
        return (
          <Link
            key={mode}
            href={HREFS[mode]}
            replace
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative flex flex-1 items-center justify-center text-[16px] leading-[22px]",
              selected ? "font-bold text-app-text" : "font-medium text-app-muted"
            )}
          >
            {SALE_TAB_MODE_LABELS[mode]}
            {showNew ? (
              <span
                aria-label="새 경매"
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-app-danger text-[11px] font-bold leading-none text-white"
              >
                N
              </span>
            ) : null}
            {count > 0 ? (
              <span
                aria-label={`임보 구해요 ${count}개`}
                className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-app-danger px-1 text-[10px] font-bold leading-none text-white"
              >
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
            {selected ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-app-text" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
