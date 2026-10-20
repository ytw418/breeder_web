"use client";

import { useState } from "react";
import { BottomSheet } from "@components/app/BottomSheet";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import {
  OTHER_REASON,
  REPORT_DETAIL_MAX,
  REPORT_DETAIL_MIN_FOR_OTHER,
  REPORT_REASONS,
  REPORT_SHEET_TITLE,
  type ReportTargetType,
} from "@libs/shared/report";

/**
 * 게시글·댓글·상품·채팅방·사용자 통합 신고 시트(POST /api/reports). 앱 ReportSheet 와 같은 문구·구성.
 * 사유 라디오 행 + 내용(기타는 5자 이상, 최대 500자) + "신고 접수" 주 CTA(앱 design/mockups/moderation #report-sheet).
 * 사유는 미리 고르지 않는다 — 고르기 전에는 접수가 눌리지 않는다(잘못된 '스팸' 신고가 쌓이던 문제, 커뮤니티 감사 #12).
 * 입력 상태는 시트가 열려 있는 동안만 유지된다(닫히면 폼이 언마운트돼 초기화).
 */
export function ReportSheet({
  open,
  targetType,
  targetId,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  targetType: ReportTargetType;
  targetId: number | null;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={REPORT_SHEET_TITLE[targetType]}
      ariaLabel={REPORT_SHEET_TITLE[targetType]}
    >
      {open ? (
        <ReportForm
          targetType={targetType}
          targetId={targetId}
          onDone={() => {
            onClose();
            onSubmitted?.();
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

function ReportForm({
  targetType,
  targetId,
  onDone,
}: {
  targetType: ReportTargetType;
  targetId: number | null;
  onDone: () => void;
}) {
  const reasons = REPORT_REASONS[targetType];
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [pending, setPending] = useState(false);

  // 대상 종류가 바뀌어 이전 사유가 목록에 없으면 고르지 않은 상태로 본다.
  const selectedReason = reasons.includes(reason) ? reason : "";
  const isOther = selectedReason === OTHER_REASON;
  const trimmedDetail = detail.trim();
  const detailTooShort = isOther && trimmedDetail.length < REPORT_DETAIL_MIN_FOR_OTHER;
  const disabled = pending || !selectedReason || detailTooShort || targetId == null;

  const handleSubmit = async () => {
    if (disabled || !selectedReason || targetId == null) return;
    setPending(true);
    try {
      const res = await authFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: selectedReason,
          detail: trimmedDetail || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "신고 접수 중 오류가 발생했습니다.");
        return;
      }
      toast.success("신고가 접수되었습니다. 운영자가 검토 후 조치합니다.");
      onDone();
    } catch {
      toast.error("신고 접수 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="pb-4">
      <div role="radiogroup" aria-label="신고 사유" className="flex flex-col">
        {reasons.map((item) => {
          const checked = item === selectedReason;
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setReason(item)}
              className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-app-text transition-colors hover:bg-app-surface"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                  checked ? "border-app-brand bg-app-brand" : "border-app-muted"
                )}
              >
                {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
              {item}
            </button>
          );
        })}
      </div>
      <div className="mt-2 px-4">
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value.slice(0, REPORT_DETAIL_MAX))}
          placeholder={
            isOther ? "신고 내용을 5자 이상 입력해주세요." : "신고 내용을 입력해주세요. (선택)"
          }
          aria-label="신고 내용"
          maxLength={REPORT_DETAIL_MAX}
          className="min-h-[96px] max-h-40 w-full resize-none rounded-lg border border-app-border bg-app-bg px-3.5 py-3 text-[14px] text-app-text placeholder:text-app-caption focus:border-app-text focus:ring-0"
        />
      </div>
      <p className="mt-1.5 px-4 text-right text-[12px] text-app-muted">
        {`${detail.length}/${REPORT_DETAIL_MAX}`}
      </p>
      <div className="px-4">
        <button
          type="button"
          disabled={disabled}
          onClick={handleSubmit}
          className="mt-4 h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "접수 중..." : "신고 접수"}
        </button>
      </div>
    </div>
  );
}

export default ReportSheet;
