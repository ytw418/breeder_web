"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { useCategoryScopeState } from "@libs/client/categoryScope";
import { cn } from "@libs/client/utils";
import type { ProductsResponse } from "@libs/shared/home";
import {
  adoptionScopePaths,
  SALE_TAB_MODE_LABELS,
  SALE_TAB_SWIPE,
  saleTabModesShowing,
  saleTabSwipeAxis,
  saleTabSwipeTarget,
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

/** 관심 분야 고정 경로와 분양 탭 칸. 공유 링크로 입양 쪽을 열었는데 강아지·고양이를 고정하지 않았으면 '입양' 칸을 붙여 지금 쪽을 보인다. */
function useSaleTabModes(active: SaleTabMode) {
  const { pins } = useCategoryScopeState();
  const paths = useMemo(() => pins.map((pin) => pin.path), [pins]);
  const modes = useMemo(() => saleTabModesShowing(paths, active), [paths, active]);
  return { paths, modes };
}

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
  const { paths, modes } = useSaleTabModes(active);
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

/** 이 안에서 시작한 터치는 좌우로 밀어도 칸을 넘기지 않는다(입력칸·시트·대화상자). */
const SWIPE_IGNORE = 'input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"]';

/** 시작점이 가로로 스크롤되는 줄(칩 줄·임보 레일) 안이면 그 줄이 먼저다. 넘칠 게 없는 줄은 목록과 같다. */
function inHorizontalScroller(target: Element | null, root: Element) {
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const { overflowX } = window.getComputedStyle(el);
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

// 밀어서 넘기면 새 쪽을 맨 위에서 보인다(웹은 세 쪽이 창 스크롤 하나를 같이 써서, 그대로 두면 새 목록의 엉뚱한 곳이 보인다).
let scrollTopOnArrival = false;

/**
 * 분양 탭 목록을 좌우로 밀어 전환 칸을 넘긴다(2026-10-23 사용자 "좌우로 슥 넘기면 탭 전환", 앱 docs/prd/pet-space.md §5.1).
 * 넘길지는 앱과 같은 규칙이다(saleTabSwipeAxis·saleTabSwipeTarget — 가로로 먼저 24px 움직이고, 64px 이상 밀거나 빠르게 튕기면 옆 칸).
 * 세로 스크롤은 그대로 두려고 passive 터치만 듣고, 화면 양 끝 20px(브라우저 앞뒤 이동 몸짓)·가로로 넘치는 줄·입력칸·시트에서
 * 시작한 터치, 두 손가락, 글자를 고르는 중이면 쓰지 않는다. 고정 위치인 FAB·시트가 틀어지지 않게 감싼 상자는 움직이지 않는다.
 */
export function SaleTabSwipeArea({
  active,
  className,
  children,
}: {
  active: SaleTabMode;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { modes } = useSaleTabModes(active);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!scrollTopOnArrival) return;
    scrollTopOnArrival = false;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root || modes.length < 2) return;
    let start: { x: number; y: number } | null = null;
    let axis: "x" | "y" | null = null;
    // 손을 뗄 때 속도는 마지막 100ms 동안 움직인 거리로 잰다.
    let samples: { x: number; t: number }[] = [];
    const reset = () => {
      start = null;
      axis = null;
      samples = [];
    };
    const onStart = (event: TouchEvent) => {
      reset();
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX < SALE_TAB_SWIPE.edge || touch.clientX > window.innerWidth - SALE_TAB_SWIPE.edge) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(SWIPE_IGNORE) || inHorizontalScroller(target, root)) return;
      start = { x: touch.clientX, y: touch.clientY };
      samples = [{ x: touch.clientX, t: event.timeStamp }];
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      axis = axis ?? saleTabSwipeAxis(touch.clientX - start.x, touch.clientY - start.y);
      if (axis === "y") {
        reset();
        return;
      }
      samples.push({ x: touch.clientX, t: event.timeStamp });
      while (samples.length > 2 && event.timeStamp - samples[0].t > 100) samples.shift();
    };
    const onEnd = (event: TouchEvent) => {
      const from = start;
      const first = samples[0];
      const locked = axis === "x";
      reset();
      const touch = event.changedTouches[0];
      if (!from || !first || !locked || !touch) return;
      if (window.getSelection()?.toString()) return;
      const dt = event.timeStamp - first.t;
      const next = saleTabSwipeTarget(modes, active, {
        dx: touch.clientX - from.x,
        dy: touch.clientY - from.y,
        vx: dt > 0 ? ((touch.clientX - first.x) / dt) * 1000 : 0,
      });
      if (!next) return;
      scrollTopOnArrival = window.scrollY > 0;
      router.replace(HREFS[next], { scroll: false });
    };
    const options = { passive: true } as const;
    root.addEventListener("touchstart", onStart, options);
    root.addEventListener("touchmove", onMove, options);
    root.addEventListener("touchend", onEnd, options);
    root.addEventListener("touchcancel", reset, options);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", reset);
    };
  }, [active, modes, router]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
