"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import useScopeTerms from "@/hooks/useScopeTerms";
import { cn } from "@libs/client/utils";

const ITEMS = [
  { key: "products", label: "분양", href: "/products" },
  { key: "auctions", label: "경매", href: "/auctions" },
] as const;

/** 이번 브라우저 세션에서 경매를 열었는지(sessionStorage). 막혀 있으면 그냥 매번 보인다. */
const AUCTION_OPENED_KEY = "bredy.auctionTabOpened";

const readOpened = () => {
  try {
    return window.sessionStorage.getItem(AUCTION_OPENED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * 분양 탭 맨 위 '분양 | 경매' 밑줄 탭(앱 docs/prd/home-v2.md S-2, 시안 home-photo-question/B-tabs.html ②③).
 * 높이 48, 같은 너비. 선택 16/700 text + 2px 밑줄, 비선택 16/500 muted. 웹은 /products ↔ /auctions 링크다
 * (앱은 한 탭 안에서 ?mode=auctions 로 바꾼다). 포유류만 고정했으면 경매를 숨기므로 줄을 그리지 않는다.
 * 이번 브라우저 세션에서 경매를 아직 안 열었으면 '경매' 옆에 빨간 'N'(지름 16, 11/700 흰 글자) — 2026-10-22 사용자
 * "앱을 켜고 종료하기 전까지 경매 탭을 안 눌렀다면 new 표시로 클릭 유도". 앱은 실행마다(src/lib/auctionTabMark.ts).
 */
export default function SaleTabSwitch({ active }: { active: "products" | "auctions" }) {
  const { showAuctions } = useScopeTerms();
  // 서버 렌더와 맞추려고 처음엔 숨기고, 붙은 뒤 세션 기록을 읽는다.
  const [auctionOpened, setAuctionOpened] = useState(true);
  useEffect(() => {
    if (active === "auctions") {
      try {
        window.sessionStorage.setItem(AUCTION_OPENED_KEY, "1");
      } catch {
        // 저장이 막혀도 이번 화면에서는 경매를 보고 있다.
      }
      return;
    }
    setAuctionOpened(readOpened());
  }, [active]);
  if (!showAuctions) return null;
  return (
    <nav aria-label="분양 · 경매" className="flex h-12 border-b border-app-line bg-app-bg">
      {ITEMS.map((item) => {
        const selected = item.key === active;
        const showNew = item.key === "auctions" && !selected && !auctionOpened;
        return (
          <Link
            key={item.key}
            href={item.href}
            replace
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative flex flex-1 items-center justify-center text-[16px] leading-[22px]",
              selected ? "font-bold text-app-text" : "font-medium text-app-muted"
            )}
          >
            {item.label}
            {showNew ? (
              <span
                aria-label="새 경매"
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-app-danger text-[11px] font-bold leading-none text-white"
              >
                N
              </span>
            ) : null}
            {selected ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-app-text" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
