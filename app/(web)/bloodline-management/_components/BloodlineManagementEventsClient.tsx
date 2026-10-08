"use client";

/**
 * 혈통 이벤트 — 기존 웹 톤(A안), 혈통 v2 용어(설계 §4.4 WB-3)
 * 원본: bredy_app src/app/bloodline-management/events.tsx
 *
 * 헤더(뒤로 + 제목 18/700) → 설명 13/muted → 검색 인풋 → 필터 칩(전체/만들기/보내기/회수)
 * → 플랫 이벤트 행(44 원형 아이콘 + 문장 15/600 "도윤파파님에게 보냈어요" + 혈통 이름·메모 13 muted + 시간 13 muted).
 * 서버가 가린 사용자(masked)는 "닉네임 비공개 분"으로 보이고 검색 대상에서 빠진다. LINE_CREATED(중복 기록)는 숨긴다.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { Input } from "@components/ui/input";
import { FilterChip } from "@components/app/FilterChip";
import { QueryErrorState } from "@components/app/QueryErrorState";
import {
  BloodlineHeader,
  BLOODLINE_EVENT_LABELS,
  BloodlineSpinner,
  bloodlineEventSearchText,
  bloodlineInputClass,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import { loadMergedBloodlineEvents } from "@libs/client/bloodlineCardEvents";
import {
  bloodlineEventSentence,
  formatBloodlineEventTime,
  isHiddenBloodlineEvent,
  type BloodlineCardEventItem,
  type BloodlineCardItem,
  type BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";

type FilterKey = "all" | "created" | "sent" | "revoked";

/** 앱 events.tsx 와 같은 칩. 보내기 = 출처 카드 보내기·다음 분에게 보내기·혈통 넘기기. */
const FILTERS: { key: FilterKey; label: string; actions?: string[] }[] = [
  { key: "all", label: "전체" },
  { key: "created", label: "만들기", actions: ["BLOODLINE_CREATED"] },
  { key: "sent", label: "보내기", actions: ["LINE_ISSUED", "LINE_TRANSFER", "BLOODLINE_TRANSFER"] },
  { key: "revoked", label: "회수", actions: ["CARD_REVOKED"] },
];

function EventIcon({ action }: { action: string }) {
  const d =
    action === "CARD_REVOKED"
      ? "M20 12h-15m0 0l5.5-5.5M5 12l5.5 5.5"
      : action.endsWith("_TRANSFER")
        ? "M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5"
        : "M12 5v14M5 12h14";
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 둘째 줄: 혈통 이름 · 메모. 사람 이름은 첫 줄 문장에 있다. */
function eventSubtitle(event: BloodlineCardEventItem) {
  return [event.relatedCard?.name, event.note?.trim()].filter(Boolean).join(" · ");
}

function EventRow({ event, first }: { event: BloodlineCardEventItem; first: boolean }) {
  const subtitle = eventSubtitle(event);
  const title = bloodlineEventSentence(event) || BLOODLINE_EVENT_LABELS[event.action] || event.action;
  const body = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-surface text-app-text">
        <EventIcon action={event.action} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-[-0.2px] text-app-text">
          {title}
        </span>
        {subtitle ? (
          <span className="mt-[3px] block truncate text-[13px] tracking-[-0.2px] text-app-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[13px] tracking-[-0.2px] text-app-muted">
        {formatBloodlineEventTime(event.createdAt)}
      </span>
    </>
  );
  const rowClass = `flex items-center gap-3 bg-app-bg px-4 py-3.5 ${first ? "" : "border-t border-app-line"}`;
  if (!event.relatedCard?.id) return <div className={rowClass}>{body}</div>;
  return (
    <Link
      href={`/bloodline-management/card/${event.relatedCard.id}`}
      aria-label={title}
      className={`${rowClass} transition-colors hover:bg-app-surface`}
    >
      {body}
    </Link>
  );
}

function allCards(data: BloodlineCardsResponse | undefined): BloodlineCardItem[] {
  if (!data) return [];
  const cards = [
    ...(data.myBloodlines || []),
    ...(data.createdLines || []),
    ...(data.receivedBloodlines || []),
    ...(data.receivedLines || []),
  ];
  return cards.length ? cards : data.ownedCards || [];
}

export default function BloodlineManagementEventsClient() {
  const { user, isLoading: userLoading } = useUser();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(loggedOut, "/bloodline-management/events");

  const cardsQuery = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);
  const cardIds = useMemo(
    () => Array.from(new Set(allCards(cardsQuery.data).map((card) => card.id))).slice(0, 25),
    [cardsQuery.data]
  );
  const eventsQuery = useSWR(
    user?.id && cardIds.length > 0 ? ["bloodline-card-events", ...cardIds] : null,
    () => loadMergedBloodlineEvents(cardIds, 10)
  );

  const filteredEvents = useMemo(() => {
    const events = (eventsQuery.data ?? []).filter((event) => !isHiddenBloodlineEvent(event.action));
    const actions = FILTERS.find((item) => item.key === filter)?.actions;
    const byAction = actions ? events.filter((event) => actions.includes(event.action)) : events;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return byAction;
    // 가린 닉네임은 검색 대상에서 뺀다
    return byAction.filter((event) => bloodlineEventSearchText(event).includes(normalized));
  }, [eventsQuery.data, filter, query]);

  if (userLoading || loggedOut) {
    return (
      <Layout headerVariant="none" seoTitle="혈통 이벤트">
        <BloodlineHeader title="혈통 이벤트" />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  const isBusy = cardsQuery.isLoading || eventsQuery.isLoading;
  const cardsError = Boolean(cardsQuery.error) && !cardsQuery.data;
  const eventsError = Boolean(eventsQuery.error) && !eventsQuery.data;

  return (
    <Layout headerVariant="none" seoTitle="혈통 이벤트">
      <BloodlineHeader title="혈통 이벤트" />

      <p className="truncate px-4 pt-3 text-[13px] tracking-[-0.2px] text-app-muted">
        내 혈통과 받은 출처 카드의 이력을 최신순으로 모았어요.
      </p>

      <div className="px-4 pt-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="닉네임 · 혈통 이름 검색"
          aria-label="닉네임 · 혈통 이름 검색"
          autoComplete="off"
          className={bloodlineInputClass}
        />
      </div>

      <div className="flex gap-1.5 px-4 pt-3">
        {FILTERS.map((item) => (
          <FilterChip
            key={item.key}
            label={item.label}
            selected={item.key === filter}
            onClick={() => setFilter(item.key)}
            className="px-3"
          />
        ))}
      </div>

      <div className="mt-3">
        {isBusy ? (
          <div className="flex justify-center py-12">
            <BloodlineSpinner />
          </div>
        ) : cardsError || eventsError ? (
          <QueryErrorState
            title="혈통 이벤트를 불러오지 못했어요"
            onRetry={() => {
              if (cardsError) void cardsQuery.mutate();
              else void eventsQuery.mutate();
            }}
          />
        ) : filteredEvents.length ? (
          filteredEvents.map((event, index) => (
            <EventRow key={event.id} event={event} first={index === 0} />
          ))
        ) : (
          <p className="py-12 text-center text-[14px] tracking-[-0.2px] text-app-muted">
            표시할 이벤트가 없어요.
          </p>
        )}
      </div>
    </Layout>
  );
}
