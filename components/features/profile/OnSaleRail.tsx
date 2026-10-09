"use client";
/**
 * 프로필 '지금 분양 중' 줄(앱 OnSaleRail, 앱 docs/prd/profile.md v5 F-17).
 * 진행 중 경매(마감 임박순) → 판매중·예약중 상품(최신순) 카드 132px. 남은 게 있으면 끝에 '+N 전체 보기' 칸.
 * 비었거나 못 받았으면 아무것도 그리지 않는다(본인 빈 상태는 완성 카드 '첫 분양 글'이 맡는다).
 */
import Link from "next/link";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import { formatAuctionTimeLeft } from "@libs/auctionRules";
import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { formatProductPrice } from "@libs/shared/price";
import type { OnSaleItem, UserOnSaleResponse } from "pages/api/users/[id]/on-sale";

export const useUserOnSale = (userId: number | string | undefined) =>
  useSWR<UserOnSaleResponse>(userId ? `/api/users/${userId}/on-sale` : null);

function Pill({ tone, children }: { tone: "brand" | "dark"; children: string }) {
  return (
    <span
      className={
        tone === "brand"
          ? "absolute left-1.5 top-1.5 rounded-md bg-app-brand px-1.5 py-0.5 text-[11px] font-bold leading-4 text-white"
          : "absolute left-1.5 top-1.5 rounded-md bg-black px-1.5 py-0.5 text-[11px] font-bold leading-4 text-white"
      }
    >
      {children}
    </span>
  );
}

function OnSaleCard({ item }: { item: OnSaleItem }) {
  const isAuction = item.kind === "auction";
  const href = isAuction ? `/auctions/${item.id}` : `/products/${item.id}`;
  const title = isAuction ? item.title : item.name;
  const price = isAuction ? `${item.currentPrice.toLocaleString("ko-KR")}원` : formatProductPrice(item.price);
  const meta = isAuction ? formatAuctionTimeLeft(item.endAt) : getTimeAgoString(new Date(item.createdAt));
  return (
    <Link
      href={href}
      className="w-[132px] shrink-0 snap-start"
      aria-label={`${isAuction ? "경매 " : item.status === "예약중" ? "예약중 " : ""}${title}, ${price}, ${meta}`}
    >
      <span className="relative block h-[132px] w-[132px] overflow-hidden rounded-xl bg-app-placeholder">
        {item.photo ? (
          <Image
            src={makeImageUrl(item.photo, "public")}
            alt=""
            fill
            sizes="132px"
            className="object-cover"
          />
        ) : null}
        {isAuction ? <Pill tone="brand">경매</Pill> : item.status === "예약중" ? <Pill tone="dark">예약중</Pill> : null}
      </span>
      <span className="mt-2 line-clamp-2 block text-[14px] font-medium leading-[19px] text-app-text">{title}</span>
      <span className="mt-1 block text-[15px] font-bold leading-5 text-app-text">{price}</span>
      <span className="mt-0.5 block text-[12px] leading-4 text-app-muted">{meta}</span>
    </Link>
  );
}

export default function OnSaleRail({
  data,
  isLoading,
  onSeeAll,
}: {
  data?: UserOnSaleResponse;
  isLoading: boolean;
  /** '전체 보기' — 분양(상품이 있으면) 또는 경매 탭으로 옮긴다. */
  onSeeAll: (tab: "products" | "auctions") => void;
}) {
  if (isLoading && !data) {
    return (
      <div className="pb-4" aria-hidden="true">
        <div className="h-9 px-4" />
        <div className="flex gap-2.5 px-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-[132px] shrink-0">
              <span className="block h-[132px] animate-pulse rounded-xl bg-app-placeholder" />
              <span className="mt-2 block h-3.5 w-[90%] animate-pulse rounded bg-app-placeholder" />
              <span className="mt-1.5 block h-4 w-[60%] animate-pulse rounded bg-app-placeholder" />
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (!data?.success || !data.items.length) return null;

  const totalCount = data.total.products + data.total.auctions;
  const rest = totalCount - data.items.length;
  const seeAllTab = data.total.products > 0 ? "products" : "auctions";
  return (
    <section aria-label="지금 분양 중" className="pb-4">
      <div className="flex h-9 items-center justify-between px-4">
        <h3 className="text-[15px] font-bold text-app-text">
          지금 분양 중 <span className="ml-0.5 text-[13px] font-normal text-app-muted">{totalCount}</span>
        </h3>
        <button
          type="button"
          onClick={() => onSeeAll(seeAllTab)}
          className="-mr-2 p-2 text-[13px] font-semibold text-app-muted"
        >
          전체 보기 ›
        </button>
      </div>
      <div className="app-rail flex scroll-px-4 gap-2.5 px-4">
        {data.items.map((item) => (
          <OnSaleCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
        {rest > 0 ? (
          <button
            type="button"
            onClick={() => onSeeAll(seeAllTab)}
            className="flex h-[132px] w-[132px] shrink-0 snap-start flex-col items-center justify-center rounded-xl bg-app-surface"
          >
            <span className="text-[17px] font-bold text-app-text">+{rest}</span>
            <span className="mt-0.5 text-[12px] text-app-muted">전체 보기</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
