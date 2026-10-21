"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TradeKeywordPicker,
  TradeProductSummary,
  type AdoptionConfirmProduct,
} from "@components/features/trade/AdoptionConfirmSheet";
import { TradeSheet, TradeSheetCta } from "@components/features/trade/TradeSheet";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import type { ProductTradeReview } from "@libs/shared/tradeReview";

/** 이미 후기가 있거나 겹친 요청(409) — 시트를 닫고 화면을 다시 받는다(앱 PRD E-8·E-12). */
const CLOSE_ERROR_CODES = new Set(["REVIEW_EXISTS", "TRADE_CONFLICT"]);

/** 거래 후기 오류(서버 문구·errorCode). 확정 시트의 onSubmitReview 도 이 오류를 던진다. */
export class TradeReviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string
  ) {
    super(message);
    this.name = "TradeReviewError";
  }
}

/** POST /api/products/:id/review {keywords} — 실패하면 TradeReviewError 를 던진다. */
export async function postProductReview(productId: number, keywords: string[]): Promise<ProductTradeReview> {
  const res = await authFetch(`/api/products/${productId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords }),
  });
  const result = (await res.json().catch(() => null)) as {
    success?: boolean;
    review?: ProductTradeReview;
    error?: string;
    message?: string;
    errorCode?: string;
  } | null;
  if (!res.ok || !result?.success || !result.review) {
    throw new TradeReviewError(
      result?.error || result?.message || "후기를 보내지 못했어요. 다시 시도해 주세요.",
      res.status,
      result?.errorCode
    );
  }
  return result.review;
}

/**
 * 거래 후기 시트(앱 TradeReviewSheet, 앱 docs/prd/trade-review.md S-6, 시안 #sheet-review). 입양 확정 시트와 같은 틀:
 * 제목 '거래 후기' · 분양글 요약 · '어떤 점이 좋았나요? (1~5개)' 키워드 칩 · '보내기'(0개면 비활성) ·
 * '아쉬운 점은 신고 또는 고객센터로 알려 주세요'(신고 = 분양자 USER 신고, 고객센터 = /support).
 * 열기 조건은 상세 trade.canReview(하단 바·입양내역 '거래 후기 쓰기').
 */
export function TradeReviewSheet({
  open,
  product,
  onClose,
  onChanged,
  onReportSeller,
}: {
  open: boolean;
  product: AdoptionConfirmProduct;
  onClose: () => void;
  /** 보냈거나 거래 상태가 바뀐 오류 뒤 — 상세·프로필·내역을 다시 받는다. */
  onChanged: () => void;
  /** '신고'를 누르면 시트를 닫은 뒤 부른다(분양자 USER 신고 시트). */
  onReportSeller: () => void;
}) {
  if (!open) return null;
  return <ReviewSheet product={product} onClose={onClose} onChanged={onChanged} onReportSeller={onReportSeller} />;
}

function ReviewSheet({
  product,
  onClose,
  onChanged,
  onReportSeller,
}: {
  product: AdoptionConfirmProduct;
  onClose: () => void;
  onChanged: () => void;
  onReportSeller: () => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending || picked.length === 0) return;
    setPending(true);
    try {
      await postProductReview(product.id, picked);
      toast.success("거래 후기를 남겼어요");
      onChanged();
      onClose();
    } catch (error) {
      if (!(error instanceof TradeReviewError)) {
        toast.error("후기를 보내지 못했어요. 다시 시도해 주세요.");
        return;
      }
      toast.error(error.message);
      // 자격·상태가 바뀌었을 수 있다 — 화면 값을 다시 받는다. 409 는 다시 보내도 같아 시트를 닫는다.
      onChanged();
      if (error.errorCode && CLOSE_ERROR_CODES.has(error.errorCode)) onClose();
    } finally {
      setPending(false);
    }
  };

  const linkClass = "font-semibold text-app-text underline-offset-2 hover:underline disabled:opacity-60";
  return (
    <TradeSheet
      title="거래 후기"
      busy={pending}
      onClose={onClose}
      footer={
        <div className="pt-5">
          <TradeSheetCta
            label={pending ? "보내는 중..." : "보내기"}
            disabled={pending || picked.length === 0}
            onClick={() => void submit()}
          />
          <p className="mt-3 break-keep px-4 text-center text-[13px] text-app-muted">
            아쉬운 점은{" "}
            <button
              type="button"
              aria-label="분양자 신고하기"
              disabled={pending}
              onClick={() => {
                onClose();
                onReportSeller();
              }}
              className={linkClass}
            >
              신고
            </button>{" "}
            또는{" "}
            <button
              type="button"
              aria-label="고객센터로 가기"
              disabled={pending}
              onClick={() => {
                onClose();
                router.push("/support");
              }}
              className={linkClass}
            >
              고객센터
            </button>
            로 알려 주세요
          </p>
        </div>
      }
    >
      <TradeProductSummary product={product} />
      <TradeKeywordPicker
        productType={product.productType}
        picked={picked}
        onChange={setPicked}
        disabled={pending}
      />
    </TradeSheet>
  );
}

export default TradeReviewSheet;
