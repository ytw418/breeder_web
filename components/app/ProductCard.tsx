"use client";

import Image from "@components/atoms/Image";
import { AuthorLink, CardOverlayLink, type AuthorLinkUser } from "@components/app/AuthorLink";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { formatProductPrice } from "@libs/shared/price";
import { useIsUnread } from "@libs/client/unreadMarks";
import { productStatusLabel } from "@libs/shared/productTerms";

/** 목록 메타에 조회 수를 보이는 최소값. 작은 숫자는 오히려 빈 티가 나서 숨긴다. */
export const PRODUCT_VIEW_COUNT_MIN = 10;

export type ProductCardData = {
  id: number;
  name: string;
  price: number | null;
  image?: string | null;
  createdAt: string | Date;
  category?: string | null;
  status?: string | null;
  isDeleted?: boolean | null;
  isHidden?: boolean | null;
  wishCount?: number | null;
  /** 조회 수. PRODUCT_VIEW_COUNT_MIN 이상일 때만 메타에 "조회 N". 안 넘기면(프로필 내역 등) 그리지 않는다. */
  viewCount?: number | null;
  /** 사진 장수. 2장 이상이면 썸네일 오른쪽 아래에 숫자. */
  photoCount?: number | null;
  /** 판매자 id. 내 상품에는 안 본 점을 달지 않는다. */
  sellerId?: number | null;
  /** 판매자. 넘기면(홈·상품 목록·혈통 분양글) 메타 맨 앞에 아바타 16 + 닉네임을 보인다. 프로필 내역은 안 넘긴다. */
  seller?: AuthorLinkUser | null;
};

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** "카테고리 · 3분 전 · 조회 12" (상대시간은 getTimeAgoString 문구, 조회는 PRODUCT_VIEW_COUNT_MIN 이상만). */
export function getProductCardMeta(
  product: Pick<ProductCardData, "category" | "createdAt" | "viewCount">
) {
  const date = toDate(product.createdAt);
  const timeAgo = Number.isNaN(date.getTime()) ? "" : getTimeAgoString(date);
  const views = product.viewCount ?? 0;
  return [
    product.category || null,
    timeAgo || null,
    views >= PRODUCT_VIEW_COUNT_MIN ? `조회 ${views}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 메타 앞 중립 pill 라벨. 삭제·숨김 상품이 먼저, 그다음 예약중·판매완료. */
export function getProductStatusLabel(
  product: Pick<ProductCardData, "status" | "isDeleted" | "isHidden">
) {
  if (product.isDeleted) return "삭제된 분양글";
  if (product.isHidden) return "숨김 분양글";
  if (product.status === "예약중" || product.status === "판매완료") return productStatusLabel(product.status);
  return null;
}

/**
 * 당근 톤 상품 플랫 행(앱 ProductCard). 높이 108, 88px 썸네일(r8), 하단 1px app-line.
 * [안 본 점] 이름 16/500(2줄) · [상태 pill] 메타 13 app-muted · 가격 16/700 + 관심 수.
 * markUnread: 홈·상품 목록처럼 둘러보는 목록에서만 켠다(7일 안·안 연 상품에 빨간 점, 프로필 내역은 끔).
 * 판매완료·삭제·숨김은 썸네일을 어둡게 덮는다.
 * seller 를 넘기면 메타 맨 앞에 판매자(누르면 프로필, 행 높이 그대로, 시안 author-row/A-karrot.html A-②).
 * 상세 링크는 행을 투명하게 덮고(CardOverlayLink) 판매자만 그 위에서 프로필로 간다.
 * href: 기본은 상품 상세. 삭제·숨김 상품은 상세가 404 라 기본으로 링크가 없고, 소유자 화면처럼
 * 열어야 하면 href 를 직접 넘긴다. href={null} 이면 항상 링크 없음.
 */
export function ProductCard({
  product,
  href,
  className,
  markUnread = false,
}: {
  product: ProductCardData;
  href?: string | null;
  className?: string;
  markUnread?: boolean;
}) {
  const unread = useIsUnread("product", {
    id: product.id,
    createdAt: product.createdAt,
    authorId: product.sellerId ?? null,
  });
  const showDot = markUnread && unread;
  const photoCount = product.photoCount ?? 0;
  const statusLabel = getProductStatusLabel(product);
  const meta = getProductCardMeta(product);
  const isInactive = Boolean(product.isDeleted || product.isHidden);
  const isDimmed = product.status === "판매완료" || isInactive;
  const resolvedHref =
    href === null ? null : href ?? (isInactive ? null : getProductPath(product.id, product.name));
  const hearts = product.wishCount ?? 0;
  const seller = product.seller;

  const content = (
    <>
      <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
        {product.image ? (
          <Image
            src={makeImageUrl(product.image, "product")}
            alt={product.name}
            width={88}
            height={88}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-app-caption" aria-hidden="true">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {isDimmed ? (
          <div className="pointer-events-none absolute inset-0 bg-app-overlay opacity-50" />
        ) : null}
        {photoCount > 1 ? (
          <span className="absolute bottom-1 right-1 h-[18px] min-w-[18px] rounded-full bg-app-overlay px-[5px] text-center text-[11px] font-semibold leading-[18px] text-white">
            {photoCount}
          </span>
        ) : null}
      </div>

      <div className="flex h-[88px] min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-start gap-1.5">
          {showDot ? (
            <span
              aria-label="안 본 분양글"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-danger"
            />
          ) : null}
          <p className="line-clamp-2 min-w-0 break-keep text-[16px] font-medium leading-[22px] text-app-text">
            {product.name}
          </p>
        </div>
        {statusLabel || seller || meta ? (
          <div className={cn("mt-0.5 flex min-w-0 items-center", seller ? "gap-1" : "gap-1.5")}>
            {statusLabel ? (
              <span className="shrink-0 rounded bg-app-surface px-1.5 py-px text-[11px] font-semibold leading-4 text-app-muted">
                {statusLabel}
              </span>
            ) : null}
            {seller ? (
              <AuthorLink
                user={seller}
                avatarSize={16}
                className="max-w-[116px] shrink-0 gap-1"
                nameClassName="text-[13px] font-semibold leading-[18px] text-app-sub"
              />
            ) : null}
            {meta ? (
              <span className="truncate text-[13px] leading-[18px] text-app-muted">
                {seller ? `· ${meta}` : meta}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[16px] font-bold text-app-text">
            {formatProductPrice(product.price)}
          </span>
          {hearts > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] text-app-muted">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span aria-label={`관심 ${hearts}`}>{hearts}</span>
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "relative flex h-[108px] items-center gap-3 border-b border-app-line bg-app-bg px-4",
        className
      )}
    >
      {resolvedHref ? <CardOverlayLink href={resolvedHref} label={product.name} /> : null}
      {content}
    </div>
  );
}

export default ProductCard;
