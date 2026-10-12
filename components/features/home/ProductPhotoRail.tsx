"use client";
/**
 * 홈 '지금 올라온 분양' 사진 레일(community-vibe §3.6 F-6, 시안 .rail/.ph).
 * 120 정사각 r12, 24시간 안 글이면 왼쪽 위 NEW 주황 칩 20, 이름 14/500 1줄, 가격 13 tabular.
 * 맨 끝은 brand-soft '내 개체 올리기 / 첫 분양글이면 상단 고정' → /products/upload.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { PRODUCT_RAIL_NEW_HOURS } from "@libs/shared/communityVibe";
import { formatProductPrice } from "@libs/shared/price";
import { HorizontalRail } from "@components/ui/HorizontalRail";

export type RailProduct = {
  id: number;
  name: string;
  price: number | null;
  image: string | null;
  createdAt: string | Date;
  isNew?: boolean;
};

/** 서버가 isNew 를 안 주면(구 서버) 작성 시각으로 판단한다. */
export function isRailNew(item: RailProduct, now: number = Date.now()): boolean {
  if (typeof item.isNew === "boolean") return item.isNew;
  const t = new Date(item.createdAt).getTime();
  return !Number.isNaN(t) && now - t < PRODUCT_RAIL_NEW_HOURS * 3600_000;
}

export default function ProductPhotoRail({ items, loading }: { items: RailProduct[]; loading?: boolean }) {
  return (
    <section className="pt-3" aria-label="지금 올라온 분양" data-home-section="product_rail">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="app-t-section">지금 올라온 분양</h2>
        <Link href="/products" className="flex items-center gap-0.5 text-[13px] text-app-muted">
          전체 보기
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
      <HorizontalRail label="지금 올라온 분양 목록" className="gap-2 px-4" data-testid="product-photo-rail">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="w-[120px] shrink-0" aria-hidden="true">
                <div className="h-[120px] w-[120px] animate-pulse rounded-xl bg-app-placeholder" />
                <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
              </div>
            ))
          : items.map((item) => (
              <Link
                key={item.id}
                href={getProductPath(item.id, item.name)}
                className="w-[120px] shrink-0 transition-transform active:scale-[0.98]"
              >
                <span className="relative block h-[120px] w-[120px] overflow-hidden rounded-xl bg-app-placeholder">
                  {item.image ? (
                    <Image
                      src={makeImageUrl(item.image, "product")}
                      alt=""
                      width={120}
                      height={120}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  {isRailNew(item) ? (
                    <span className="absolute left-2 top-2 h-5 rounded-[4px] bg-app-brand px-1.5 text-[11px] font-semibold leading-5 text-white">
                      NEW
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block truncate text-[14px] font-medium leading-5 text-app-text">{item.name}</span>
                <span className="block text-[13px] leading-[18px] text-app-muted tabular-nums">
                  {formatProductPrice(item.price)}
                </span>
              </Link>
            ))}
        <Link href="/products/upload" className="w-[120px] shrink-0" data-testid="rail-upload-card">
          <span className="flex h-[120px] w-[120px] items-center justify-center rounded-xl bg-app-brand-soft text-app-brand">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="mt-1.5 block truncate text-[14px] font-medium leading-5 text-app-brand">내 개체 올리기</span>
          <span className="block truncate text-[13px] leading-[18px] text-app-muted">첫 분양글이면 상단 고정</span>
        </Link>
      </HorizontalRail>
    </section>
  );
}
