"use client";

import { InitialAvatar } from "@components/ui/InitialAvatar";
import { cn } from "@libs/client/utils";
import { SOLD_PRODUCT_STATUS, type ProductTradeInfo } from "@libs/shared/tradeReview";

/**
 * 분양 상세 본문 거래 영역(앱 TradeActionBlock, 앱 docs/prd/trade-review.md S-3, 시안 #detail-*). 분양완료 글에서만 그린다.
 * - 분양자·운영자(manage): 행 48 "입양자를 아직 정하지 않았어요 · 지정하기 ›" / "아바타 24 · 입양자 ○○ · 입양 확정 대기 · 바꾸기 ›" /
 *   "… · 입양 확정 완료"(잠김) / "브리디 밖에서 분양한 글이에요 · 바꾸기 ›". 바꿀 수 있을 때 행 전체를 누르면 입양자 시트.
 * - 지정된 입양자: 12 muted 안내 한 줄(하단 바 주 버튼은 상세 화면이 바꾼다).
 * - 그 밖의 회원: 미지정 글에서 분양자와 대화했으면 보조 40 '제가 입양했어요 — 입양자 지정 요청' + 안내,
 *   예전 입양자면 '분양자가 입양자를 바꿨어요'. 그 밖에는 아무것도 없다(공개 '입양 확정' 버튼은 없앴다).
 */
export function TradeActionBlock({
  trade,
  manage,
  onOpenPicker,
  onRequestBuyer,
  requestPending,
  requested,
}: {
  trade: ProductTradeInfo;
  /** 분양자 또는 운영자 이메일 계정(삭제·숨김 글 제외) */
  manage: boolean;
  onOpenPicker: () => void;
  onRequestBuyer: () => void;
  requestPending: boolean;
  /** 이 화면에서 지정 요청을 보냈다(버튼 자리에 안내를 둔다). */
  requested: boolean;
}) {
  if (trade.status !== SOLD_PRODUCT_STATUS) return null;
  const content = blockContent({ trade, manage, onOpenPicker, onRequestBuyer, requestPending, requested });
  // 아래 16 여백(시안 .trow 뒤 16px) — 다음 섹션 갭에 붙지 않게.
  return content ? <div className="pb-4">{content}</div> : null;
}

function blockContent({
  trade,
  manage,
  onOpenPicker,
  onRequestBuyer,
  requestPending,
  requested,
}: {
  trade: ProductTradeInfo;
  manage: boolean;
  onOpenPicker: () => void;
  onRequestBuyer: () => void;
  requestPending: boolean;
  requested: boolean;
}) {
  if (manage) return <SellerRow trade={trade} onOpenPicker={onOpenPicker} />;

  if (trade.buyerIsMe) {
    const note = trade.canConfirm
      ? "분양자가 회원님을 입양자로 지정했어요"
      : trade.canReview
        ? "입양을 확정했어요 · 거래 후기를 남기면 분양자 프로필에 보여요"
        : null;
    return note ? <Note text={note} /> : null;
  }

  if (trade.canRequestBuyer || requested) {
    return (
      <div className="mt-4">
        {requested ? (
          <Note text="입양자 지정을 요청했어요 · 분양자가 지정하면 알려 드려요" first />
        ) : (
          <>
            <div className="mb-2 px-4">
              <button
                type="button"
                aria-label="제가 입양했어요, 분양자에게 입양자 지정 요청하기"
                disabled={requestPending}
                onClick={onRequestBuyer}
                className="h-10 w-full rounded-md bg-app-surface text-[14px] font-semibold text-app-text disabled:opacity-60"
              >
                {requestPending ? "요청 중..." : "제가 입양했어요 — 입양자 지정 요청"}
              </button>
            </div>
            <Note text="분양자에게 알림이 가요. 분양자가 지정하면 입양 확정과 후기를 남길 수 있어요" first />
          </>
        )}
      </div>
    );
  }

  if (trade.wasBuyer) {
    return (
      <p className="mx-4 mt-4 flex items-center gap-1.5 text-[13px] text-app-muted">
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0" />
          <path d="M12 8h.01M11 12h1v4h1" />
        </svg>
        분양자가 입양자를 바꿨어요
      </p>
    );
  }
  return null;
}

/** 12 muted 안내 한 줄(시안 .note12). first 면 위 여백 없이 버튼 바로 아래에 둔다. */
function Note({ text, first = false }: { text: string; first?: boolean }) {
  return (
    <p className={cn("break-keep px-4 text-[12px] leading-[17px] text-app-muted", !first && "mt-4")}>{text}</p>
  );
}

/** 분양자 입양자 행 48(위아래 1px line, 시안 .trow). */
function SellerRow({ trade, onOpenPicker }: { trade: ProductTradeInfo; onOpenPicker: () => void }) {
  const external = trade.buyerSource === "external";
  const assigned = trade.buyerAssigned && !external;
  const name = trade.buyer?.name?.trim();
  const label = external
    ? "브리디 밖에서 분양한 글이에요"
    : assigned
      ? name
        ? `입양자 ${name}`
        : "입양자"
      : "입양자를 아직 정하지 않았어요";
  const state = assigned ? (trade.purchaseConfirmed ? "입양 확정 완료" : "입양 확정 대기") : null;
  const action = trade.canChangeBuyer ? (assigned || external ? "바꾸기 ›" : "지정하기 ›") : null;
  const a11yLabel = [label, state, action ? action.replace(" ›", "") : null].filter(Boolean).join(", ");

  const content = (
    <>
      {assigned ? <InitialAvatar name={trade.buyer?.name} avatar={trade.buyer?.avatar} size={24} /> : null}
      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-app-text">
        {label}
        {state ? <span className="text-app-muted">{` · ${state}`}</span> : null}
      </span>
      {action ? (
        <span
          className={
            assigned || external
              ? "shrink-0 text-[13px] text-app-muted"
              : "shrink-0 text-[14px] font-semibold text-app-brand-text"
          }
        >
          {action}
        </span>
      ) : null}
    </>
  );
  const rowClass = "mt-4 flex min-h-[48px] w-full items-center gap-2 border-y border-app-line px-4 text-left";

  if (!action) return <div className={rowClass}>{content}</div>;
  return (
    <button
      type="button"
      aria-label={a11yLabel}
      onClick={onOpenPicker}
      className={cn(rowClass, "transition-colors hover:bg-app-surface")}
    >
      {content}
    </button>
  );
}

export default TradeActionBlock;
