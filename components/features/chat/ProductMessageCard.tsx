"use client";

/**
 * 분양글 카드 말풍선 — 앱 bredy_app src/components/features/chat/ProductMessageCard.tsx
 * (앱 docs/prd/trade-review.md S-1.기본, 시안 design/mockups/trade-review/A-karrot.html #chat-buyer-card · #chat-seller).
 * 메시지 행에 productId 가 있으면 글자 말풍선 대신 이 카드를 그린다.
 * 폭 232 r16 · 1px surface 테두리 · elevated 바탕 · 패딩 10: 썸네일 64 r8 · '분양글' 11 muted ·
 * 제목 14/600 2줄 · 가격 14/700 · 상태 pill 11. 누르면 분양 상세.
 * product 가 null 이면(지웠거나 숨긴 글) 같은 틀에 '볼 수 없는 분양글이에요'만 두고 누를 수 없다.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import { formatProductPrice } from "@libs/productRules";
import { productStatusLabel } from "@libs/shared/productTerms";
import type { ChatMessageProduct } from "@libs/shared/tradeChat";

const FRAME = "flex w-[232px] max-w-full items-start gap-2.5 rounded-2xl border border-app-surface bg-app-elevated p-2.5";

function CardThumb({ image }: { image?: string | null }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
      {image ? (
        <Image src={makeImageUrl(image, "product")} alt="" fill sizes="64px" className="object-cover" />
      ) : null}
    </div>
  );
}

export default function ProductMessageCard({ product }: { product: ChatMessageProduct | null }) {
  if (!product) {
    return (
      <div role="group" aria-label="볼 수 없는 분양글" className={FRAME}>
        <CardThumb />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-[14px] text-app-muted">분양글</p>
          <p className="mt-0.5 text-[14px] leading-[19px] text-app-muted">볼 수 없는 분양글이에요</p>
        </div>
      </div>
    );
  }
  const price = formatProductPrice(product.price);
  const status = product.statusLabel || productStatusLabel(product.status);
  return (
    <Link
      href={`/products/${product.id}`}
      aria-label={["분양글", product.name, price, status].filter(Boolean).join(", ")}
      className={FRAME}
    >
      <CardThumb image={product.image} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-[14px] text-app-muted">분양글</p>
        <p className="mt-0.5 line-clamp-2 break-words text-[14px] font-semibold leading-[19px] text-app-text">
          {product.name}
        </p>
        <p className="mt-0.5 text-[14px] font-bold leading-[19px] text-app-text">{price}</p>
        {status ? (
          <span className="mt-1 inline-flex h-[18px] items-center rounded-lg bg-app-surface px-1.5 text-[11px] text-app-sub">
            {status}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
