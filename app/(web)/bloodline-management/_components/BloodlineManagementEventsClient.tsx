"use client";

/**
 * 혈통 이벤트 — 당근 톤(A안) 1:1
 * 원본: bredy_app src/app/bloodline-management/events.tsx
 *
 * 헤더(뒤로 + 제목 18/700) → 설명 13/muted → 검색 인풋 → 필터 칩
 * → 플랫 이벤트 행(44 원형 아이콘 + 제목 15/600 + 보조 13 muted + 시간 13 muted, 1px line).
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
  BloodlineSpinner,
  bloodlineInputClass,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import { loadMergedBloodlineEvents } from "@libs/client/bloodlineCardEvents";
import {
  formatBloodlineEventTime,
  type BloodlineCardEventItem,
  type BloodlineCardItem,
  type BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";

const actionLabel: Record<string, string> = {
  BLOODLINE_CREATED: "혈통카드 생성",
  BLOODLINE_TRANSFER: "혈통카드 보내기",
  LINE_CREATED: "라인 생성",
  LINE_ISSUED: "라인 발급",
  LINE_TRANSFER: "라인 보내기",
  CARD_REVOKED: "카드 철회",
};

type FilterKey = "all" | "created" | "transfer" | "revoked";

const FILTERS: { key: FilterKey; label: string; actions?: string[] }[] = [
  { key: "all", label: "전체" },
  { key: "created", label: "발급", actions: ["BLOODLINE_CREATED", "LINE_CREATED", "LINE_ISSUED"] },
  { key: "transfer", label: "보내기", actions: ["BLOODLINE_TRANSFER", "LINE_TRANSFER"] },
  { key: "revoked", label: "철회", actions: ["CARD_REVOKED"] },
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

function eventSubtitle(event: BloodlineCardEventItem) {
  const who = event.actorUser?.name || "시스템";
  const flow = event.toUser ? `${event.fromUser?.name ?? who} → ${event.toUser.name}` : null;
  return [event.relatedCard?.name, flow ?? who, event.note].filter(Boolean).join(" · ");
}

function EventRow({ event, first }: { event: BloodlineCardEventItem; first: boolean }) {
  const subtitle = eventSubtitle(event);
  const body = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-surface text-app-text">
        <EventIcon action={event.action} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-[-0.2px] text-app-text">
          {actionLabel[event.action] || event.action}
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
      aria-label={actionLabel[event.action] || event.action}
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
    const events = eventsQuery.data ?? [];
    const actions = FILTERS.find((item) => item.key === filter)?.actions;
    const byAction = actions ? events.filter((event) => actions.includes(event.action)) : events;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return byAction;
    return byAction.filter((event) =>
      `${event.action} ${actionLabel[event.action] || ""} ${event.actorUser?.name || ""} ${
        event.fromUser?.name || ""
      } ${event.toUser?.name || ""} ${event.relatedCard?.name || ""} ${event.note || ""}`
        .toLowerCase()
        .includes(normalized)
    );
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
        보유 카드의 활동 이력을 최신순으로 모았어요.
      </p>

      <div className="px-4 pt-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="액션 · 닉네임 · 카드명 검색"
          aria-label="액션 · 닉네임 · 카드명 검색"
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
