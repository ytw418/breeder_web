"use client";

import Link from "next/link";
import { formatKstDateTime } from "@libs/shared/sanction";
import type { AccountRestriction } from "@libs/client/accountRestriction";

/**
 * 이용 제한 안내(S-6, 앱 account-restricted 화면과 같은 내용). 기간 정지는 해제 시각, 영구 정지는 해제일 없이 보여 준다.
 * 사유 기록이 없는 옛 정지는 사유 줄 없이 기간만 보인다.
 * 시안: 앱 design/mockups/moderation/A-karrot.html #restricted
 */

const SHIELD_PATH = "M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z";

export default function AccountRestrictedNotice({
  restriction,
  onConfirm,
}: {
  restriction: AccountRestriction;
  onConfirm: () => void;
}) {
  const banned = restriction.errorCode === "ACCOUNT_BANNED";
  const until = restriction.suspendedUntil ? new Date(restriction.suspendedUntil) : null;
  const structured = Boolean(restriction.reasonLabel || until || banned);

  return (
    <div className="flex min-h-screen w-full flex-col bg-app-bg">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-5 pt-28">
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-app-surface text-app-muted">
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d={SHIELD_PATH} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mb-7 mt-5 text-center text-[20px] font-bold leading-[1.35] text-app-text">
          {banned ? "이용이 영구 정지된 계정이에요" : "이용이 정지된 계정이에요"}
        </h1>

        <div className="w-full">
          {restriction.reasonLabel ? (
            <div className="flex gap-3 border-y border-app-line py-3.5 text-[15px] leading-[22px]">
              <span className="w-14 shrink-0 text-[14px] text-app-muted">사유</span>
              <span className="min-w-0 flex-1 font-semibold text-app-text">{restriction.reasonLabel}</span>
            </div>
          ) : null}
          {restriction.messageToUser ? (
            <div className="mt-4">
              <p className="text-[14px] text-app-muted">운영자 메시지</p>
              <p className="mt-1.5 whitespace-pre-line rounded-lg bg-app-surface px-3.5 py-3 text-[15px] leading-[22px] text-app-text">
                {restriction.messageToUser}
              </p>
            </div>
          ) : null}
        </div>

        {!banned && until ? (
          <p className="mt-7 text-center text-[15px] font-semibold leading-[22px] text-app-text">
            {formatKstDateTime(until)} 이후 다시 이용할 수 있어요.
          </p>
        ) : null}
        {!structured ? (
          <p className="mt-7 text-center text-[15px] leading-[22px] text-app-text">{restriction.message}</p>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-sm gap-2 px-5 pb-6 pt-2">
        <Link
          href="/support"
          className="grid h-[52px] flex-1 place-items-center rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
        >
          고객센터 문의
        </Link>
        <button
          type="button"
          onClick={onConfirm}
          className="h-[52px] flex-1 rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
