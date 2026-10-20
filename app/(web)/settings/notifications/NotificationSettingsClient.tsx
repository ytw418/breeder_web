"use client";

import { useState } from "react";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { BottomSheet } from "@components/app/BottomSheet";
import { QueryErrorState } from "@components/app/QueryErrorState";
import Toggle from "@components/app/Toggle";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import {
  NOTIFICATION_PREF_COPY,
  NOTIFICATION_PREF_KINDS,
  formatQuietHour,
  mergePrefs,
  normalizePrefs,
  quietRangeLabel,
  type NotificationPrefs,
  type NotificationPrefsPatch,
} from "@libs/shared/notificationPrefs";
import type { NotificationPrefsResponse } from "pages/api/users/me/notification-prefs";

/**
 * 설정 > 알림 > 알림 종류(앱 settings/notifications.tsx 와 같은 구성, 2026-10-21).
 * 시안: 앱 design/mockups/notifications/A-karrot.html #noti-prefs·#noti-quiet-sheet, PRD 앱 docs/prd/notifications.md §7.
 * 스위치를 누르면 바로 바뀐 것으로 보이고(낙관 갱신) 저장에 실패하면 되돌린 뒤 토스트를 띄운다.
 */

const PREFS_KEY = "/api/users/me/notification-prefs";
const SAVE_ERROR = "알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="bg-app-bg px-4 pb-2 pt-[18px]">
      <h3 className="text-[13px] font-semibold text-app-muted">{title}</h3>
    </div>
  );
}

/** 설정 화면 56 행 톤: 이름 16/500 + 설명 13 muted, 오른쪽 스위치. */
function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex min-h-[56px] items-center border-b border-app-line bg-app-bg px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium leading-[22px] text-app-text">{label}</p>
        {description ? (
          <p className="mt-0.5 break-keep text-[13px] leading-[18px] text-app-muted">{description}</p>
        ) : null}
      </div>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-app-caption">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HourStepper({
  label,
  hour,
  onChange,
}: {
  label: string;
  hour: number;
  onChange: (hour: number) => void;
}) {
  const buttonClass =
    "grid h-9 w-9 place-items-center rounded-full bg-app-surface text-[20px] leading-none text-app-text";
  return (
    <div className="flex h-14 items-center gap-3 px-4">
      <span className="flex-1 text-[16px] font-medium text-app-text">{label}</span>
      <button
        type="button"
        aria-label={`${label} 한 시간 앞으로`}
        className={buttonClass}
        onClick={() => onChange((hour + 23) % 24)}
      >
        −
      </button>
      <span className="w-[88px] text-center text-[16px] font-semibold text-app-text">{formatQuietHour(hour)}</span>
      <button
        type="button"
        aria-label={`${label} 한 시간 뒤로`}
        className={buttonClass}
        onClick={() => onChange((hour + 1) % 24)}
      >
        +
      </button>
    </div>
  );
}

function QuietHoursSheet({
  open,
  start,
  end,
  onClose,
  onSave,
}: {
  open: boolean;
  start: number;
  end: number;
  onClose: () => void;
  onSave: (range: { start: number; end: number }) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="방해 금지 시간">
      {open ? <QuietHoursForm initialStart={start} initialEnd={end} onSave={onSave} /> : null}
    </BottomSheet>
  );
}

function QuietHoursForm({
  initialStart,
  initialEnd,
  onSave,
}: {
  initialStart: number;
  initialEnd: number;
  onSave: (range: { start: number; end: number }) => void;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const same = start === end;
  return (
    <div className="pb-4">
      <HourStepper label="시작" hour={start} onChange={setStart} />
      <HourStepper label="끝" hour={end} onChange={setEnd} />
      {same ? (
        <p className="px-4 pt-1 text-[13px] text-app-muted">시작과 끝을 다르게 골라 주세요.</p>
      ) : null}
      <div className="px-4 pt-3">
        <button
          type="button"
          disabled={same}
          onClick={() => onSave({ start, end })}
          className="h-[52px] w-full rounded-lg bg-app-brand text-[16px] font-semibold text-white disabled:opacity-50"
        >
          완료
        </button>
      </div>
    </div>
  );
}

export default function NotificationSettingsClient() {
  const { data, error, isLoading, mutate } = useSWR<NotificationPrefsResponse>(PREFS_KEY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const prefs: NotificationPrefs = normalizePrefs(data?.prefs);

  const save = async (patch: NotificationPrefsPatch) => {
    // 빠르게 여러 개를 눌러도 앞 변경이 지워지지 않게 화면에 보이는 전체 설정을 보낸다.
    const next = mergePrefs(prefs, patch);
    try {
      await mutate(
        async () => {
          const res = await authFetch(PREFS_KEY, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
          const result = (await res.json().catch(() => null)) as NotificationPrefsResponse | null;
          if (!res.ok || !result?.success) throw new Error(SAVE_ERROR);
          return result;
        },
        {
          optimisticData: { success: true, prefs: next },
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        }
      );
    } catch {
      toast.error(SAVE_ERROR);
    }
  };

  let content;
  if (isLoading) {
    content = <LoadingBlock />;
  } else if (error && !data) {
    content = <QueryErrorState onRetry={() => void mutate()} />;
  } else {
    content = (
      <>
        <SectionTitle title="받을 알림" />
        {NOTIFICATION_PREF_KINDS.map((kind) => (
          <SwitchRow
            key={kind}
            label={NOTIFICATION_PREF_COPY[kind].label}
            description={NOTIFICATION_PREF_COPY[kind].description}
            checked={prefs[kind]}
            onChange={() => void save({ [kind]: !prefs[kind] })}
          />
        ))}

        <div className="h-2 bg-app-gap" aria-hidden="true" />

        <SectionTitle title="방해 금지" />
        <SwitchRow
          label="방해 금지"
          description="정한 시간에는 푸시 없이 알림 목록에만 쌓여요"
          checked={prefs.quiet.enabled}
          onChange={() => void save({ quiet: { enabled: !prefs.quiet.enabled } })}
        />
        {prefs.quiet.enabled ? (
          <>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex min-h-[56px] w-full items-center border-b border-app-line bg-app-bg px-4 transition-colors hover:bg-app-surface"
            >
              <span className="flex-1 text-left text-[16px] font-medium text-app-text">시간</span>
              <span className="mr-1 text-[14px] text-app-muted">{quietRangeLabel(prefs.quiet)}</span>
              <ChevronIcon />
            </button>
            <SwitchRow
              label="채팅·경매는 예외"
              description="방해 금지 시간에도 채팅·경매 알림은 받아요"
              checked={prefs.quiet.exemptChatTrade}
              onChange={() => void save({ quiet: { exemptChatTrade: !prefs.quiet.exemptChatTrade } })}
            />
          </>
        ) : null}

        <p className="break-keep px-4 pb-6 pt-3 text-[13px] leading-[18px] text-app-muted">
          꺼 둔 알림도 알림 목록에는 쌓여요. 운영 안내는 항상 받아요.
        </p>
      </>
    );
  }

  return (
    <Layout canGoBack title="알림 종류" seoTitle="알림 종류">
      <div className="bg-app-bg">{content}</div>
      <QuietHoursSheet
        open={sheetOpen}
        start={prefs.quiet.start}
        end={prefs.quiet.end}
        onClose={() => setSheetOpen(false)}
        onSave={(range) => {
          setSheetOpen(false);
          void save({ quiet: range });
        }}
      />
    </Layout>
  );
}
