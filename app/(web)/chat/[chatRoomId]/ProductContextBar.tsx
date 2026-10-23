"use client";

/**
 * 분양글 문맥 바 — 앱 ProductContextBar (시안 chat .ctx, 버튼은 trade-review #chat-seller·#chat-buyer-confirm·#chat-buyer-review).
 * 썸네일 56 r8 · 제목 14 sub · 가격 15/700 · 상태 13 muted, 오른쪽 viewerAction 버튼 32 r6(null 이면 없음).
 * 서버가 chatRoom.product 를 줄 때만 그린다. 왼쪽(사진·글자)을 누르면 분양 상세.
 * 분양자 '분양완료'는 보조(surface 바탕 brand-text 글자), 입양자 버튼은 주황 채움.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";
import { productPriceText } from "@libs/shared/price";
import type { ChatProductAction, ChatRoomProduct } from "@libs/shared/tradeChat";

export type ChatTradeAction = Exclude<ChatProductAction, null>;

const ACTION_LABEL: Record<ChatTradeAction, string> = {
  sold: "분양완료",
  confirm: "입양 확정",
  review: "거래 후기 쓰기",
};

export function ProductContextBar({
  product,
  onAction,
}: {
  product: ChatRoomProduct;
  onAction: (action: ChatTradeAction) => void;
}) {
  const action = product.viewerAction;
  const price = productPriceText(product);
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-app-line bg-app-bg px-4 py-2.5">
      <Link
        href={`/products/${product.id}`}
        aria-label={["분양글 보기", product.name, price, product.statusLabel].filter(Boolean).join(", ")}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
          {product.image ? (
            <Image src={makeImageUrl(product.image, "product")} alt="" fill sizes="56px" className="object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] text-app-sub">{product.name}</p>
          <p className="mt-0.5 text-[15px] font-bold text-app-text">{price}</p>
          {product.statusLabel ? <p className="mt-px truncate text-[13px] text-app-muted">{product.statusLabel}</p> : null}
        </div>
      </Link>
      {action ? (
        <button
          type="button"
          aria-label={ACTION_LABEL[action]}
          onClick={() => onAction(action)}
          className={cn(
            "h-8 shrink-0 rounded-md px-3 text-[13px] font-semibold",
            action === "sold" ? "bg-app-surface text-app-brand-text" : "bg-app-brand text-white"
          )}
        >
          {ACTION_LABEL[action]}
        </button>
      ) : null}
    </div>
  );
}
