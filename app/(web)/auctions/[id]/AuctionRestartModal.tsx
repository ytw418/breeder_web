"use client";

import { useState } from "react";
import useMutation from "hooks/useMutation";
import { cn } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { getAuctionResultMessage } from "@libs/client/auctionErrorMessage";
import { getPresetEndAtMs } from "@libs/auctionRules";
import {
  AUCTION_RESTART_COPY,
  AUCTION_RESTART_REASONS,
  type AuctionRestartReasonId,
  type AuctionRestartState,
} from "@libs/shared/auctionRestart";
import type { RestartAuctionResponse } from "pages/api/auctions/[id]/restart";
import {
  CenterModal,
  DURATION_PRESETS,
  FormChip,
  SheetButton,
  formatConfirmDateTime,
} from "../AuctionFormParts";

const DEFAULT_HOURS = 24;

/**
 * 경매 다시 시작 창(앱 AuctionRestartSheet 와 같은 구성). 기간만 새로 고르고,
 * 낙찰자가 있던 경매면 사유를 골라 낙찰을 취소한다(재입찰 막기 + 운영 신고). 앱 docs/prd/auction-restart.md
 */
export function AuctionRestartModal({
  open,
  onClose,
  auctionId,
  round,
  startPrice,
  restart,
  onRestarted,
}: {
  open: boolean;
  onClose: () => void;
  auctionId: number;
  round: number;
  startPrice: number;
  restart: AuctionRestartState;
  onRestarted: () => void;
}) {
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [reason, setReason] = useState<AuctionRestartReasonId | null>(null);
  const [submit, { loading }] = useMutation<
    RestartAuctionResponse & { message?: string; status?: number }
  >(`/api/auctions/${auctionId}/restart`);
  const nextRound = round + 1;
  const endAtText = formatConfirmDateTime(
    new Date(getPresetEndAtMs(hours)).toISOString(),
  );
  const disabled = loading || (restart.reasonRequired && !reason);

  const close = () => {
    if (loading) return;
    onClose();
  };

  const confirm = () => {
    if (disabled) return;
    // 누른 시점 기준으로 마감을 다시 계산한다(창을 오래 열어 둬도 기간이 줄지 않게).
    const endAt = new Date(getPresetEndAtMs(hours)).toISOString();
    submit({
      data: restart.reasonRequired ? { endAt, reason } : { endAt },
      onCompleted(result) {
        if (!result.success) {
          toast.error(
            getAuctionResultMessage(result, AUCTION_RESTART_COPY.button),
          );
          if (result.errorCode === "AUCTION_RESTART_CONFLICT") onRestarted();
          return;
        }
        toast.success(
          AUCTION_RESTART_COPY.success(result.auction?.round ?? nextRound),
          {
            description: AUCTION_RESTART_COPY.endsAt(
              formatConfirmDateTime(result.auction?.endAt ?? endAt),
            ),
          },
        );
        setReason(null);
        setHours(DEFAULT_HOURS);
        onClose();
        onRestarted();
      },
      onError() {
        toast.error("네트워크 연결을 확인해 주세요.");
      },
    }).catch(() => undefined);
  };

  return (
    <CenterModal open={open} onClose={close} label="경매 다시 시작 팝업">
      <h2 className="text-[18px] font-bold text-app-text">
        {AUCTION_RESTART_COPY.sheetTitle}
      </h2>
      <p className="mt-2 text-[15px] leading-[22px] text-app-muted">
        {AUCTION_RESTART_COPY.sheetDescription(nextRound, startPrice)}
      </p>

      <p className="mt-4 text-[15px] font-semibold text-app-text">
        {AUCTION_RESTART_COPY.durationLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DURATION_PRESETS.map((preset) => (
          <FormChip
            key={preset.hours}
            label={preset.label}
            active={hours === preset.hours}
            onClick={() => setHours(preset.hours)}
          />
        ))}
      </div>
      <p className="mt-2 text-[13px] text-app-muted">
        {AUCTION_RESTART_COPY.endsAt(endAtText)}
      </p>

      {restart.reasonRequired ? (
        <>
          <p className="mt-4 text-[15px] font-semibold text-app-text">
            {AUCTION_RESTART_COPY.reasonLabel}
          </p>
          <div
            role="radiogroup"
            aria-label={AUCTION_RESTART_COPY.reasonLabel}
            className="mt-1 flex flex-col"
          >
            {AUCTION_RESTART_REASONS.map((option) => {
              const selected = reason === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setReason(option.id)}
                  className="flex h-11 items-center gap-2.5 text-left"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-app-brand" : "border-app-border",
                    )}
                  >
                    {selected ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-app-brand" />
                    ) : null}
                  </span>
                  <span className="text-[15px] text-app-text">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 rounded-lg bg-app-surface p-3 text-[13px] leading-5 text-app-muted">
            {AUCTION_RESTART_COPY.winnerNotice}
          </p>
        </>
      ) : null}

      <p className="mt-3 text-[13px] text-app-muted">
        {AUCTION_RESTART_COPY.restartsLeft(restart.restartsLeft)}
      </p>

      <div className="mt-5 flex gap-2">
        <SheetButton
          label={AUCTION_RESTART_COPY.cancel}
          tone="ghost"
          disabled={loading}
          fill
          onClick={close}
        />
        <SheetButton
          label={
            loading
              ? AUCTION_RESTART_COPY.submitting
              : AUCTION_RESTART_COPY.confirm
          }
          tone="primary"
          disabled={disabled}
          fill
          onClick={confirm}
        />
      </div>
    </CenterModal>
  );
}
