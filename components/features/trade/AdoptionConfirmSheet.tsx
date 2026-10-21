"use client";

import { useState } from "react";
import Image from "@components/atoms/Image";
import { TradeSheet, TradeSheetCta } from "@components/features/trade/TradeSheet";
import { authFetch } from "@libs/client/authFetch";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import { formatProductPrice } from "@libs/shared/price";
import {
  keywordsForProduct,
  TRADE_REVIEW_MAX_KEYWORDS,
  type ProductTradeInfo,
} from "@libs/shared/tradeReview";

export interface AdoptionConfirmProduct {
  id: number;
  name: string;
  price: number | null;
  /** 대표 사진 id */
  photo?: string | null;
  sellerName: string;
  /** 용품이면 개체 키워드를 빼고 공통 5개만 보인다(keywordsForProduct). */
  productType: string | null;
}

export type AdoptionConfirmResult = { trade?: ProductTradeInfo; reviewFailed?: boolean };

/**
 * 입양 확정 시트(앱 AdoptionConfirmSheet, 앱 docs/prd/trade-review.md S-5, 시안 #sheet-confirm).
 * 제목 '입양 확정' · 분양글 요약 56 · (후기 API 를 넘기면) '어떤 점이 좋았나요? (선택, 1~5개)' 키워드 칩 · '입양 확정하기' · '후기는 나중에'.
 * '입양 확정하기' = purchase → 키워드를 골랐으면 후기 전송. '후기는 나중에' = 키워드를 버리고 purchase 만.
 * purchase 는 됐는데 후기가 실패하면 '입양은 확정했어요. 후기는 다시 보내 주세요'(E-13)를 띄우고 닫는다.
 * onSubmitReview 가 없으면 칩·'후기는 나중에' 없이 입양 확정만 한다.
 */
export function AdoptionConfirmSheet({
  open,
  product,
  onClose,
  onChanged,
  onSubmitReview,
}: {
  open: boolean;
  product: AdoptionConfirmProduct;
  onClose: () => void;
  /** 확정 뒤(또는 오류로 상태가 바뀌었을 수 있을 때) 부른다 — 상세를 다시 받는다. */
  onChanged: (result: AdoptionConfirmResult) => void;
  /** 키워드 후기 보내기(POST /api/products/:id/review). 실패하면 throw. */
  onSubmitReview?: (keywords: string[]) => Promise<void>;
}) {
  if (!open) return null;
  return (
    <ConfirmSheet product={product} onClose={onClose} onChanged={onChanged} onSubmitReview={onSubmitReview} />
  );
}

function ConfirmSheet({
  product,
  onClose,
  onChanged,
  onSubmitReview,
}: {
  product: AdoptionConfirmProduct;
  onClose: () => void;
  onChanged: (result: AdoptionConfirmResult) => void;
  onSubmitReview?: (keywords: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const withReview = Boolean(onSubmitReview);

  const submit = async (reviewKeywords: string[]) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await authFetch(`/api/products/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase" }),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        trade?: ProductTradeInfo;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !result?.success) {
        toast.error(result?.error || result?.message || "입양 확정에 실패했어요.");
        // 403·이미 확정 등은 거래 상태가 바뀐 것이다 — 시트는 두고 상세만 다시 받는다.
        onChanged({});
        return;
      }
      let reviewFailed = false;
      if (reviewKeywords.length > 0 && onSubmitReview) {
        try {
          await onSubmitReview(reviewKeywords);
        } catch {
          reviewFailed = true;
        }
      }
      trackEvent(ANALYTICS_EVENTS.productPurchaseConfirmed, {
        product_id: product.id,
        keyword_count: reviewFailed ? 0 : reviewKeywords.length,
      });
      if (reviewFailed) toast.error("입양은 확정했어요. 후기는 다시 보내 주세요");
      else toast.success(reviewKeywords.length > 0 ? "입양을 확정하고 거래 후기를 남겼어요" : "입양을 확정했어요");
      onChanged({ trade: result.trade, reviewFailed });
      onClose();
    } catch {
      toast.error("입양 확정 중 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <TradeSheet
      title="입양 확정"
      busy={pending}
      onClose={onClose}
      footer={
        <div className="pt-5">
          <TradeSheetCta
            label={pending ? "확정 중..." : "입양 확정하기"}
            disabled={pending}
            onClick={() => void submit(picked)}
          />
          {withReview ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                aria-label="후기는 나중에 쓰고 입양만 확정하기"
                disabled={pending}
                onClick={() => void submit([])}
                className="text-[13px] font-semibold text-app-text underline-offset-2 hover:underline"
              >
                후기는 나중에
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <TradeProductSummary product={product} />
      {withReview ? (
        <TradeKeywordPicker
          productType={product.productType}
          picked={picked}
          onChange={setPicked}
          disabled={pending}
          optional
        />
      ) : null}
    </TradeSheet>
  );
}

/** 시트 맨 위 분양글 요약 56(사진 40 r8 · 제목 14/600 · '분양자 · 가격' 12 muted, 시안 .sum). 거래 후기 시트도 쓴다. */
export function TradeProductSummary({ product }: { product: AdoptionConfirmProduct }) {
  return (
    <div className="mx-4 mt-2 flex h-14 items-center gap-3">
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
        {product.photo ? (
          <Image
            src={makeImageUrl(product.photo, "product")}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-app-text">{product.name}</span>
        <span className="mt-0.5 block truncate text-[12px] text-app-muted">
          {`${product.sellerName} · ${formatProductPrice(product.price)}`}
        </span>
      </span>
    </div>
  );
}

/**
 * '어떤 점이 좋았나요?' 키워드 칩 묶음(시안 .kw). 이 분양글 종류에 맞는 키워드만(용품이면 공통 5개),
 * 6번째를 누르면 '5개까지 고를 수 있어요'. optional 이면 제목 뒤 '(선택, 1~5개)', 아니면 '(1~5개)'.
 */
export function TradeKeywordPicker({
  productType,
  picked,
  onChange,
  disabled,
  optional = false,
}: {
  productType: string | null;
  picked: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  optional?: boolean;
}) {
  const keywords = keywordsForProduct(productType);
  const toggle = (key: string) => {
    if (disabled) return;
    if (picked.includes(key)) {
      onChange(picked.filter((item) => item !== key));
      return;
    }
    if (picked.length >= TRADE_REVIEW_MAX_KEYWORDS) {
      toast.info(`${TRADE_REVIEW_MAX_KEYWORDS}개까지 고를 수 있어요`);
      return;
    }
    onChange([...picked, key]);
  };
  return (
    <>
      <p className="px-4 pb-2.5 pt-4 text-[15px] font-semibold text-app-text">
        어떤 점이 좋았나요?{" "}
        <span className="text-[13px] font-normal text-app-muted">
          {optional ? `(선택, 1~${TRADE_REVIEW_MAX_KEYWORDS}개)` : `(1~${TRADE_REVIEW_MAX_KEYWORDS}개)`}
        </span>
      </p>
      <div className="flex flex-wrap gap-2 px-4" role="group" aria-label="좋았던 점">
        {keywords.map((item) => (
          <KeywordChip
            key={item.key}
            label={item.label}
            checked={picked.includes(item.key)}
            onClick={() => toggle(item.key)}
          />
        ))}
      </div>
    </>
  );
}

/** 키워드 칩 32 r16(끔 1px border / 켬 inverse 바탕 inverse-text 600, 시안 .kc). 거래 후기 시트도 같은 칩을 쓴다. */
export function KeywordChip({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "h-8 rounded-2xl border px-3 text-[13px]",
        checked
          ? "border-app-inverse bg-app-inverse font-semibold text-app-inverse-text"
          : "border-app-border bg-transparent font-normal text-app-text"
      )}
    >
      {label}
    </button>
  );
}

export default AdoptionConfirmSheet;
