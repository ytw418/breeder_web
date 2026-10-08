"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import type { MySanctionsResponse } from "pages/api/users/me/sanctions";
import {
  MODERATION_TARGET_LABEL,
  formatKstDate,
  formatKstDateTime,
} from "@libs/shared/sanction";

/**
 * 제재 확인 모달(S-5, 앱 SanctionNoticeModal 과 같은 내용). 확인하지 않은 경고와 끝난 정지를
 * 오래된 것부터 한 건씩 보여 주고, '확인했어요'를 눌러야 닫힌다(바깥·Esc 로 닫히지 않음).
 * 시안: 앱 design/mockups/moderation/A-karrot.html #warning-modal · #suspension-ended-modal
 */

const NOTICE_KEY = "/api/users/me/sanctions?unacknowledged=1";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[15px] leading-[22px]">
      <span className="w-14 shrink-0 whitespace-nowrap text-[14px] text-app-muted">{label}</span>
      <span className="min-w-0 flex-1 font-semibold text-app-text">{value}</span>
    </div>
  );
}

export default function SanctionNoticeModal({ enabled }: { enabled: boolean }) {
  // 탭으로 돌아올 때(포커스) 다시 조회해 쓰는 중에 받은 경고도 띄운다.
  const { data, mutate } = useSWR<MySanctionsResponse>(enabled ? NOTICE_KEY : null, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const notice = data?.success ? data.sanctions[0] : undefined;

  useEffect(() => {
    if (!notice) return;
    buttonRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [notice]);

  if (!notice) return null;

  const acknowledge = async () => {
    try {
      setSubmitting(true);
      const res = await authFetch("/api/users/me/sanctions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notice.id }),
      });
      if (!res.ok) throw new Error("ack failed");
      // 지금 건을 빼고 다음 건을 바로 보여 준다.
      await mutate(
        (prev) => (prev ? { ...prev, sanctions: prev.sanctions.filter((item) => item.id !== notice.id) } : prev),
        { revalidate: true }
      );
    } catch {
      toast.error("잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const isWarning = notice.type === "WARNING";
  const title = isWarning ? "운영정책 위반 안내" : "이용 정지가 끝났어요";
  const period =
    notice.days && notice.endsAt
      ? `${notice.days}일 (${formatKstDate(new Date(notice.startsAt))} ~ ${formatKstDate(new Date(notice.endsAt))})`
      : null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-app-overlay" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sanction-notice-title"
        className="relative w-full max-w-sm rounded-2xl border border-app-border bg-app-elevated px-5 pb-5 pt-6"
      >
        <h2 id="sanction-notice-title" className="mb-[18px] text-[18px] font-bold leading-[1.35] text-app-text">
          {title}
        </h2>

        <div className="space-y-2.5">
          <Row label="사유" value={notice.reasonLabel} />
          {isWarning ? null : period ? <Row label="기간" value={period} /> : null}
        </div>

        {isWarning && notice.messageToUser ? (
          <div className="mt-4">
            <p className="text-[14px] text-app-muted">운영자 메시지</p>
            <p className="mt-1.5 whitespace-pre-line rounded-lg bg-app-surface px-3.5 py-3 text-[15px] leading-[22px] text-app-text">
              {notice.messageToUser}
            </p>
          </div>
        ) : null}

        {isWarning && notice.target ? (
          <div className="mt-4">
            <p className="text-[14px] text-app-muted">관련 콘텐츠</p>
            <div className="mt-1.5 rounded-lg bg-app-surface px-3.5 py-3">
              <span className="inline-flex rounded-[5px] bg-app-bg px-2 py-[3px] text-[12px] leading-[1.5] text-app-muted">
                {MODERATION_TARGET_LABEL[notice.target.type]}
              </span>
              {notice.target.excerpt || notice.target.title ? (
                <p className="mt-2 line-clamp-2 text-[14px] leading-[21px] text-app-sub">
                  {notice.target.excerpt || notice.target.title}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {isWarning ? (
          <div className="mt-4">
            <Row label="일시" value={formatKstDateTime(new Date(notice.createdAt))} />
          </div>
        ) : null}

        <p className="mt-4 text-[13px] leading-[19px] text-app-muted">
          {isWarning
            ? `최근 180일 경고 ${data?.recentWarningCount ?? 1}회. 계속 위반하면 이용이 정지될 수 있어요.`
            : "다시 위반하면 더 긴 기간 이용이 정지될 수 있어요."}
        </p>

        <button
          ref={buttonRef}
          type="button"
          onClick={acknowledge}
          disabled={submitting}
          aria-busy={submitting || undefined}
          className="mt-5 h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white disabled:opacity-60"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
