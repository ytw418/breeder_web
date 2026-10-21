"use client";

import { useState } from "react";
import { TradeReviewContent, TradeReviewFrame } from "@components/features/trade/TradeReviewCard";
import { TradeSheet, TradeSheetCta } from "@components/features/trade/TradeSheet";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { TRADE_REVIEW_REPLY_MAX, type TradeReviewPublic } from "@libs/shared/tradeReview";

/** 다시 보내도 같은 결과인 오류(답글 있음·후기 없음·분양자 아님) — 시트를 닫고 화면을 다시 받는다(앱 PRD E-14). */
const CLOSE_ERROR_CODES = new Set(["REPLY_EXISTS", "REVIEW_NOT_FOUND", "FORBIDDEN"]);

/**
 * 답글 시트(앱 TradeReviewReplySheet, 앱 docs/prd/trade-review.md S-7, 시안 #sheet-reply). 받은 후기 요약(읽기 전용) ·
 * 입력 r8 1px border 최소 88 · 15/21 · '답글은 한 번만 남길 수 있어요' + 'N/300' · '등록'(공백만이면 비활성).
 * 금칙어(E-15)·글자 수처럼 입력을 고치면 되는 오류는 입력을 그대로 둔다.
 */
export function TradeReviewReplySheet({
  open,
  productId,
  review,
  onClose,
  onChanged,
}: {
  open: boolean;
  productId: number;
  review: TradeReviewPublic | null;
  onClose: () => void;
  /** 답글을 남겼거나 상태가 바뀐 오류 뒤 — 상세·목록을 다시 받는다. */
  onChanged: () => void;
}) {
  if (!open || !review) return null;
  return <ReplySheet productId={productId} review={review} onClose={onClose} onChanged={onChanged} />;
}

function ReplySheet({
  productId,
  review,
  onClose,
  onChanged,
}: {
  productId: number;
  review: TradeReviewPublic;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const trimmed = text.trim();

  const submit = async () => {
    if (pending || trimmed.length === 0) return;
    setPending(true);
    try {
      const res = await authFetch(`/api/products/${productId}/review/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
        errorCode?: string;
      } | null;
      if (!res.ok || !result?.success) {
        toast.error(result?.error || result?.message || "답글을 남기지 못했어요. 다시 시도해 주세요.");
        if (result?.errorCode && CLOSE_ERROR_CODES.has(result.errorCode)) {
          onChanged();
          onClose();
        }
        return;
      }
      toast.success("답글을 남겼어요");
      onChanged();
      onClose();
    } catch {
      toast.error("답글을 남기지 못했어요. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <TradeSheet
      title="답글 남기기"
      busy={pending}
      onClose={onClose}
      footer={
        <div className="pt-4">
          <TradeSheetCta
            label={pending ? "등록 중..." : "등록"}
            disabled={pending || trimmed.length === 0}
            onClick={() => void submit()}
          />
        </div>
      }
    >
      <TradeReviewFrame className="mb-0 mt-3">
        <TradeReviewContent review={{ ...review, reply: null }} linkAuthor={false} />
      </TradeReviewFrame>
      <div className="mt-3 px-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={pending}
          placeholder="입양자에게 남길 말을 적어 주세요"
          aria-label="답글 내용"
          maxLength={TRADE_REVIEW_REPLY_MAX}
          rows={3}
          className="block max-h-40 min-h-[88px] w-full resize-none rounded-lg border border-app-border bg-app-elevated p-3 text-[15px] leading-[21px] text-app-text placeholder:text-app-caption focus:outline-none focus:ring-1 focus:ring-app-border"
        />
      </div>
      <div className="flex px-4 pt-1.5">
        <p className="flex-1 text-[12px] text-app-muted">답글은 한 번만 남길 수 있어요</p>
        <p className="text-[12px] text-app-muted">{`${text.length}/${TRADE_REVIEW_REPLY_MAX}`}</p>
      </div>
    </TradeSheet>
  );
}

export default TradeReviewReplySheet;
