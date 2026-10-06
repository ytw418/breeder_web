"use client";

import { useState } from "react";
import { BottomSheet } from "@components/app/BottomSheet";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
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
 * 사유 드롭다운 + 내용(기타는 5자 이상, 최대 500자) + "신고 접수" 주 CTA.
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

  // 대상 종류가 바뀌어 이전 사유가 목록에 없으면 첫 사유로 본다.
  const selectedReason = reasons.includes(reason) ? reason : reasons[0];
  const isOther = selectedReason === OTHER_REASON;
  const trimmedDetail = detail.trim();
  const detailTooShort = isOther && trimmedDetail.length < REPORT_DETAIL_MIN_FOR_OTHER;
  const disabled = pending || detailTooShort || targetId == null;

  const handleSubmit = async () => {
    if (disabled || targetId == null) return;
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
    <div className="px-4 pb-4 pt-2">
      <div className="flex flex-col gap-2">
        <select
          value={selectedReason}
          onChange={(event) => setReason(event.target.value)}
          aria-label="신고 사유 선택"
          className="h-12 w-full rounded-lg border border-app-border bg-app-bg px-3.5 text-[15px] text-app-text focus:border-app-text focus:ring-0"
        >
          {reasons.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
      <p className="mt-1.5 text-right text-[12px] text-app-muted">
        {`${detail.length}/${REPORT_DETAIL_MAX}`}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={handleSubmit}
        className="mt-4 h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "접수 중..." : "신고 접수"}
      </button>
    </div>
  );
}

export default ReportSheet;
