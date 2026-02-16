"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Spinner } from "@components/atoms/Spinner";
import useUser from "hooks/useUser";
import {
 BloodlineCardEventsResponse,
 BloodlineCardItem,
 BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";

const actionLabel: Record<string, string> = {
  BLOODLINE_CREATED: "혈통카드 생성",
  BLOODLINE_TRANSFER: "혈통카드 보내기",
  LINE_CREATED: "라인 생성",
  LINE_ISSUED: "라인 발급",
  LINE_TRANSFER: "라인 보내기",
  CARD_REVOKED: "카드 철회",
};

const headerButtonClass =
 "inline-flex h-9 items-center justify-center rounded-none bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
const detailLinkClass =
 "mt-2 inline-flex h-8 items-center justify-center rounded-none bg-slate-50 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100";

export default function BloodlineManagementEventsClient() {
 const { user } = useUser();
 const { data: bloodlineData, isLoading: isBloodlineLoading } = useSWR<BloodlineCardsResponse>(
 user?.id ? "/api/bloodline-cards" : null
 );

 const [events, setEvents] = useState<BloodlineCardEventsResponse["events"]>([]);
 const [query, setQuery] = useState("");

 const cards = useMemo<BloodlineCardItem[]>(() => {
 if (!bloodlineData) return [];

 const allCards = [
 ...(bloodlineData.myBloodlines || []),
 ...(bloodlineData.createdLines || []),
 ...(bloodlineData.receivedBloodlines || []),
 ...(bloodlineData.receivedLines || []),
 ];

 if (allCards.length) {
 return allCards;
 }

 return bloodlineData.ownedCards || [];
 }, [bloodlineData]);

 const cardIds = useMemo(() => Array.from(new Set(cards.map((card) => card.id))).slice(0, 25), [cards]);

 useEffect(() => {
 if (!user?.id || cardIds.length === 0) {
 setEvents([]);
 return;
 }

 let active = true;

 const load = async () => {
 const loaded = await Promise.all(
 cardIds.map((cardId) =>
 fetch(`/api/bloodline-cards/${cardId}/events?limit=10`)
 .then((response) => response.json() as Promise<BloodlineCardEventsResponse>)
 .catch(() => ({ success: false, events: [] } as BloodlineCardEventsResponse))
 )
 );

 if (!active) return;

 const sorted = loaded
 .flatMap((item) => (item.success ? item.events || [] : []))
 .sort((left, right) =>
 new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
 );

 setEvents(sorted);
 };

 load();

 return () => {
 active = false;
 };
 }, [cardIds, user?.id]);

 const filteredEvents = useMemo(() => {
 const normalized = query.trim().toLowerCase();
 if (!normalized) return events;
 return events.filter((event) =>
 `${event.action} ${event.actorUser?.name || ""} ${event.fromUser?.name || ""} ${
 event.toUser?.name || ""
 } ${event.relatedCard?.name || ""} ${event.note || ""}`
 .toLowerCase()
 .includes(normalized)
 );
 }, [events, query]);

 return (
 <section className="app-page min-h-screen pb-6">
 <div className="mx-auto flex w-full max-w-[900px] flex-col space-y-4">
 <header className="space-y-2 rounded-none bg-white p-4">
 <p className="app-kicker">BLOODLINE MANAGEMENT</p>
 <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
 <div>
 <h1 className="app-title-xl">이벤트 타임라인</h1>
 <p className="app-body-sm mt-1 text-slate-600">보유 카드 기준으로 활동 이력을 통합 정렬했습니다.</p>
 </div>
 <Link
 href="/bloodline-management"
 className={headerButtonClass}
 >
 혈통관리 돌아가기
 </Link>
 </div>
 </header>

 <input
 value={query}
 onChange={(event) => setQuery(event.target.value)}
 placeholder="이벤트 검색 (액션/닉네임/카드명)"
          className="h-11 w-full rounded-none bg-white px-4 text-sm outline-none ring-0 transition focus:outline-none focus:ring-0"
 />

 {isBloodlineLoading ? (
 <div className="flex h-24 items-center justify-center">
 <Spinner />
 </div>
 ) : null}

 {filteredEvents.length ? (
 <div className="space-y-3">
 {filteredEvents.map((event) => (
 <article key={event.id} className="rounded-none bg-white p-3">
 <div className="flex items-start justify-between gap-2">
 <div>
 <p className="text-sm font-black text-slate-900">{actionLabel[event.action] || event.action}</p>
 <p className="mt-1 text-xs text-slate-500">
 {event.actorUser?.name || "시스템"}
 {event.fromUser ? ` · ${event.fromUser.name}` : ""}
 {event.toUser ? ` → ${event.toUser.name}` : ""}
 </p>
 {event.note ? <p className="mt-1 text-xs text-slate-600">{event.note}</p> : null}
 </div>
 <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString("ko-KR")}</span>
 </div>
 {event.relatedCard ? (
 <Link
 href={`/bloodline-management/card/${event.relatedCard.id}`}
 className={detailLinkClass}
 >
 카드 상세로 이동
 </Link>
 ) : null}
 </article>
 ))}
 </div>
 ) : (
 <p className="rounded-none bg-slate-50 p-4 text-sm text-slate-600">
 표시할 이벤트가 없습니다.
 </p>
 )}
 </div>
 </section>
 );
}
