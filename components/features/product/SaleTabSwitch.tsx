"use client";

import Link from "next/link";

import useScopeTerms from "@/hooks/useScopeTerms";
import { cn } from "@libs/client/utils";

const ITEMS = [
  { key: "products", label: "분양", href: "/products" },
  { key: "auctions", label: "경매", href: "/auctions" },
] as const;

/**
 * 분양 탭 맨 위 '분양 | 경매' 밑줄 탭(앱 docs/prd/home-v2.md S-2, 시안 home-photo-question/B-tabs.html ②③).
 * 높이 48, 같은 너비. 선택 16/700 text + 2px 밑줄, 비선택 16/500 muted. 웹은 /products ↔ /auctions 링크다
 * (앱은 한 탭 안에서 ?mode=auctions 로 바꾼다). 포유류만 고정했으면 경매를 숨기므로 줄을 그리지 않는다.
 */
export default function SaleTabSwitch({ active }: { active: "products" | "auctions" }) {
  const { showAuctions } = useScopeTerms();
  if (!showAuctions) return null;
  return (
    <nav aria-label="분양 · 경매" className="flex h-12 border-b border-app-line bg-app-bg">
      {ITEMS.map((item) => {
        const selected = item.key === active;
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
            {selected ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-app-text" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
