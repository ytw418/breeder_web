"use client";
import Image from "@components/atoms/Image";
import Link from "next/link";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { formatProductPrice } from "@libs/productRules";

interface ItemProps {
  title: string;
  id: number;
  price: number | null;
  comments?: number;
  hearts: number;
  image: string;
  createdAt: Date;
  category?: string | null;
  status?: string | null;
  minimal?: boolean;
  /** 삭제·숨김 상품(판매·구매내역 기록). 상세가 404 라 링크 없이 '삭제된 상품'으로 보인다. */
  removed?: boolean;
}

export default function Item({
  title,
  price,
  comments,
  hearts,
  id,
  image,
  createdAt,
  category,
  status,
  minimal = false,
  removed = false,
}: ItemProps) {
  const statusLabel = removed ? "삭제된 상품" : status && status !== "판매중" ? status : null;
  const content = (
    <div className={cn("flex items-center gap-3", removed && "opacity-60")}>
      <div
        className={cn(
          "h-20 w-20 flex-shrink-0 overflow-hidden bg-slate-100",
          minimal ? "rounded-md" : "rounded-xl"
        )}
      >
        <Image
          src={makeImageUrl(image, "product")}
          className="h-full w-full object-cover"
          alt="productList"
          width={80}
          height={80}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-1.5">
          {category && (
            <span
              className={cn(
                minimal
                  ? "inline-flex shrink-0 items-center whitespace-nowrap text-[11px] font-medium leading-none text-slate-500"
                  : "app-pill-accent"
              )}
            >
              {category}
            </span>
          )}
          {statusLabel && (
            <span
              className={cn(
                minimal
                  ? "inline-flex shrink-0 items-center whitespace-nowrap text-[11px] font-medium leading-none text-slate-500"
                  : "app-pill-muted"
              )}
            >
              {statusLabel}
            </span>
          )}
          <span className="app-caption">{getTimeAgoString(new Date(createdAt))}</span>
        </div>
        <p className="app-title-md line-clamp-1">{title}</p>
        <p className="mt-1 text-[15px] font-bold tracking-tight text-primary">
          {formatProductPrice(price)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            minimal ? "text-rose-500" : "app-pill-muted bg-rose-50 text-rose-500"
          )}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
          </svg>
          {hearts}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs text-slate-500",
            minimal ? "" : "app-pill-muted"
          )}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {comments ?? 0}
        </span>
      </div>
    </div>
  );

  if (removed) {
    return (
      <div
        className={cn(
          "block overflow-hidden",
          minimal ? "border-b border-slate-100 bg-white px-4 py-3" : "app-card px-4 py-3"
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={getProductPath(id, title)}
      className={cn(
        "block overflow-hidden",
        minimal
          ? "border-b border-slate-100 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
          : "app-card app-card-interactive px-4 py-3"
      )}
    >
      {content}
    </Link>
  );
}
