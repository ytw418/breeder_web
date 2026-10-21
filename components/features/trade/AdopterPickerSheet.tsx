"use client";

import { useState } from "react";
import useSWR from "swr";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { TradeRadio, TradeSheet, TradeSheetCta } from "@components/features/trade/TradeSheet";
import { authFetch } from "@libs/client/authFetch";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { toast } from "@libs/client/toast";
import { getTimeAgoString } from "@libs/client/utils";
import type {
  BuyerCandidatesResponse,
  ProductTradeInfo,
  TradeCandidateUser,
} from "@libs/shared/tradeReview";

/** sold: 분양중·예약중에서 분양완료로 바꾸며 고른다(CTA '분양완료'). assign: 분양완료 뒤 '지정하기 ›'·'바꾸기 ›'(CTA '지정하기'). */
export type AdopterPickerMode = "sold" | "assign";

type Choice = { kind: "user"; userId: number } | { kind: "external" } | { kind: "later" };

type TradeWriteResult = {
  success?: boolean;
  trade?: ProductTradeInfo;
  error?: string;
  message?: string;
  errorCode?: string;
} | null;

const SUBTITLE =
  "입양자만 입양 확정과 후기를 남길 수 있어요 · 여러 마리를 나눠 분양했다면 대표 1명을 골라 주세요";

/** 바꿀 수 없는 상태가 된 오류(이미 분양완료·잠김·충돌) — 시트를 닫고 상세를 다시 받는다. */
const STALE_ERROR_CODES = new Set(["ALREADY_SOLD", "NOT_SOLD", "NO_SALE", "TRADE_LOCKED", "TRADE_CONFLICT"]);

/**
 * '누구에게 분양했나요?' 시트(앱 AdopterPickerSheet, 앱 docs/prd/trade-review.md S-4,
 * 시안 #sheet-adopter·-empty·-loading·-error).
 * 후보는 GET buyer-candidates 3묶음(요청한 사람 → 이 분양글로 채팅한 상대 → 다른 대화 상대(접힘)).
 * 맨 위 '요청한 사람'(채팅 문맥 바에서 열면 그 방 상대)을 미리 고른다. 후보가 없거나·불러오는 중·실패여도
 * '브리디 밖에서 분양했어요'·'나중에 정할게요'는 고를 수 있다.
 */
export function AdopterPickerSheet({
  open,
  productId,
  mode,
  preselectUserId,
  onClose,
  onChanged,
}: {
  open: boolean;
  productId: number;
  mode: AdopterPickerMode;
  /** 채팅 문맥 바 '분양완료'로 열면 그 방 상대를 미리 고른다. */
  preselectUserId?: number | null;
  onClose: () => void;
  /** 저장했거나(trade 있음) 상태가 바뀌어 저장하지 못했을 때 부른다 — 상세·목록을 다시 받는다. */
  onChanged: (result: { trade?: ProductTradeInfo }) => void;
}) {
  if (!open) return null;
  return (
    <PickerSheet
      productId={productId}
      mode={mode}
      preselectUserId={preselectUserId ?? null}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function PickerSheet({
  productId,
  mode,
  preselectUserId,
  onClose,
  onChanged,
}: {
  productId: number;
  mode: AdopterPickerMode;
  preselectUserId: number | null;
  onClose: () => void;
  onChanged: (result: { trade?: ProductTradeInfo }) => void;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const candidates = useSWR<BuyerCandidatesResponse>(`/api/products/${productId}/buyer-candidates`, {
    revalidateOnFocus: false,
  });
  const requested = candidates.data?.requested ?? [];
  const primary = candidates.data?.primary ?? [];
  const others = candidates.data?.others ?? [];
  const total = requested.length + primary.length + others.length;
  const allIds = [...requested, ...primary, ...others].map((item) => item.user.id);

  // 고르기 전에는 채팅 문맥의 상대 → 지정을 요청한 맨 위 사람을 미리 고른 것으로 본다.
  const defaultUserId =
    preselectUserId != null && allIds.includes(preselectUserId)
      ? preselectUserId
      : (requested[0]?.user.id ?? null);
  const selected: Choice | null =
    choice ?? (defaultUserId != null ? { kind: "user", userId: defaultUserId } : null);
  const isChecked = (next: Choice) =>
    selected?.kind === next.kind &&
    (next.kind !== "user" || (selected.kind === "user" && selected.userId === next.userId));
  // 앞 두 묶음이 비었거나 미리 고른 사람이 '다른 대화 상대'에 있으면 접지 않는다.
  const showOthers =
    othersOpen ||
    requested.length + primary.length === 0 ||
    (defaultUserId != null && others.some((item) => item.user.id === defaultUserId));

  const pick = (next: Choice) => {
    if (!pending) setChoice(next);
  };

  const submit = async (next: Choice) => {
    if (pending) return;
    setPending(true);
    try {
      // sold '나중에 정할게요'는 옛 앱과 같은 바디(data 없음 = 미지정 분양완료).
      const res =
        mode === "sold"
          ? await authFetch(`/api/products/${productId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                next.kind === "later" ? { action: "sold" } : { action: "sold", data: toBuyerChoice(next) }
              ),
            })
          : await authFetch(`/api/products/${productId}/buyer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(toBuyerChoice(next)),
            });
      const result = (await res.json().catch(() => null)) as TradeWriteResult;
      if (!res.ok || !result?.success) {
        toast.error(result?.error || result?.message || "처리하지 못했어요.");
        const code = result?.errorCode;
        if (code === "INVALID_BUYER" || code === "BLOCKED") {
          // 후보가 바뀌었을 수 있다(차단·탈퇴) — 시트는 두고 목록만 다시 받는다.
          void candidates.mutate();
        } else if (code && STALE_ERROR_CODES.has(code)) {
          onChanged({});
          onClose();
        }
        return;
      }
      if (mode === "sold") {
        trackEvent(ANALYTICS_EVENTS.productMarkedSold, { product_id: productId, buyer: next.kind });
      }
      toast.success(successMessage(mode, next));
      onChanged({ trade: result.trade });
      onClose();
    } catch {
      toast.error("처리 중 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <TradeSheet
      title="누구에게 분양했나요?"
      subtitle={SUBTITLE}
      busy={pending}
      onClose={onClose}
      footer={
        <>
          <div className="h-2 bg-app-gap" />
          <div role="radiogroup" aria-label="다른 선택">
            <OptionRow
              label="브리디 밖에서 분양했어요"
              checked={isChecked({ kind: "external" })}
              onClick={() => pick({ kind: "external" })}
            />
            <OptionRow
              label="나중에 정할게요"
              checked={isChecked({ kind: "later" })}
              onClick={() => pick({ kind: "later" })}
            />
          </div>
          <TradeSheetCta
            className="mt-3"
            label={pending ? "처리 중..." : mode === "sold" ? "분양완료" : "지정하기"}
            disabled={!selected || pending}
            onClick={() => {
              if (selected) void submit(selected);
            }}
          />
        </>
      }
    >
      <div role="radiogroup" aria-label="입양자 후보" className="pb-2">
        {candidates.isLoading ? (
          <div className="pt-2.5" aria-label="대화 상대 불러오는 중" role="status">
            <CandidateSkeleton nameWidth={96} lineWidth={132} />
            <CandidateSkeleton nameWidth={80} lineWidth={120} />
          </div>
        ) : candidates.error && !candidates.data ? (
          <div className="flex items-center px-4 pb-0.5 pt-3.5">
            <p className="flex-1 text-[13px] text-app-muted">대화 상대를 불러오지 못했어요</p>
            <button
              type="button"
              aria-label="대화 상대 다시 불러오기"
              onClick={() => void candidates.mutate()}
              className="text-[13px] font-semibold text-app-text"
            >
              다시 시도
            </button>
          </div>
        ) : total === 0 ? (
          <p className="px-4 pb-0.5 pt-3.5 text-[13px] text-app-muted">이 분양글로 대화한 사람이 없어요</p>
        ) : (
          <>
            {requested.length > 0 ? <GroupLabel label="입양자 지정을 요청한 사람" /> : null}
            {requested.map((item) => (
              <CandidateRow
                key={`r-${item.user.id}`}
                user={item.user}
                caption={`${timeAgo(item.requestedAt)} 지정을 요청했어요`}
                checked={isChecked({ kind: "user", userId: item.user.id })}
                onClick={() => pick({ kind: "user", userId: item.user.id })}
              />
            ))}
            {primary.length > 0 ? <GroupLabel label="이 분양글로 채팅한 상대" /> : null}
            {primary.map((item) => (
              <CandidateRow
                key={`p-${item.user.id}`}
                user={item.user}
                caption={`마지막 대화 ${timeAgo(item.lastMessageAt)}`}
                checked={isChecked({ kind: "user", userId: item.user.id })}
                onClick={() => pick({ kind: "user", userId: item.user.id })}
              />
            ))}
            {others.length > 0 ? (
              <GroupLabel
                label="다른 대화 상대"
                action={showOthers ? undefined : { label: "더 보기 ›", onClick: () => setOthersOpen(true) }}
              />
            ) : null}
            {showOthers
              ? others.map((item) => (
                  <CandidateRow
                    key={`o-${item.user.id}`}
                    user={item.user}
                    caption={`마지막 대화 ${timeAgo(item.lastMessageAt)}`}
                    checked={isChecked({ kind: "user", userId: item.user.id })}
                    onClick={() => pick({ kind: "user", userId: item.user.id })}
                  />
                ))
              : null}
          </>
        )}
      </div>
    </TradeSheet>
  );
}

function toBuyerChoice(choice: Choice) {
  if (choice.kind === "user") return { buyerId: choice.userId };
  if (choice.kind === "external") return { buyerExternal: true };
  return { clear: true };
}

function successMessage(mode: AdopterPickerMode, choice: Choice): string {
  if (mode === "sold") return "분양완료 처리되었습니다.";
  if (choice.kind === "user") return "입양자를 지정했어요";
  if (choice.kind === "external") return "브리디 밖에서 분양한 글로 바꿨어요";
  return "입양자를 나중에 정하기로 했어요";
}

/** ISO 시각 → "3분 전"·"하루 전"(웹 getTimeAgoString = 앱 formatRelativeTime). 읽지 못하면 빈 문자열. */
function timeAgo(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : getTimeAgoString(date);
}

/** 묶음 소제목 12 muted(시안 .grp), 오른쪽 '더 보기 ›' 13/600. */
function GroupLabel({ label, action }: { label: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center px-4 pb-1 pt-3.5">
      <p className="flex-1 text-[12px] text-app-muted">{label}</p>
      {action ? (
        <button
          type="button"
          aria-label={`${label} 더 보기`}
          onClick={action.onClick}
          className="text-[13px] font-semibold text-app-text"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

/** 후보 행 56: 아바타 40 · 닉네임 15/600 · 마지막 대화 12 muted · 라디오 20(시안 .cand). */
function CandidateRow({
  user,
  caption,
  checked,
  onClick,
}: {
  user: TradeCandidateUser;
  caption: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${user.name}, ${caption}`}
      onClick={onClick}
      className="flex h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-app-surface"
    >
      <InitialAvatar name={user.name} avatar={user.avatar} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-app-text">{user.name}</span>
        <span className="mt-px block truncate text-[12px] text-app-muted">{caption}</span>
      </span>
      <TradeRadio checked={checked} />
    </button>
  );
}

/** '브리디 밖에서 분양했어요'·'나중에 정할게요' 행 56(15/500 + 라디오). */
function OptionRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className="flex h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-app-surface"
    >
      <span className="flex-1 text-[15px] font-medium text-app-text">{label}</span>
      <TradeRadio checked={checked} />
    </button>
  );
}

/** 후보 불러오는 중 행(아바타 40 원 + 두 줄 막대, 시안 .sk). */
function CandidateSkeleton({ nameWidth, lineWidth }: { nameWidth: number; lineWidth: number }) {
  return (
    <div className="flex h-14 items-center gap-3 px-4" aria-hidden="true">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-app-placeholder" />
      <div className="flex flex-col gap-1.5">
        <div className="h-3.5 animate-pulse rounded bg-app-placeholder" style={{ width: nameWidth }} />
        <div className="h-[11px] animate-pulse rounded bg-app-placeholder" style={{ width: lineWidth }} />
      </div>
    </div>
  );
}

export default AdopterPickerSheet;
