"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Spinner } from "@components/atoms/Spinner";
import useUser from "hooks/useUser";
import {
  BloodlineCardIssueLineResponse,
  BloodlineCardItem,
  BloodlineCardEventsResponse,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";

type ActiveAction = "transfer" | "issue" | null;

interface BloodlineCardDetailClientProps {
  cardId: number;
}

interface Drafts {
  [cardId: number]: {
    toUserName?: string;
    note?: string;
    lineName?: string;
  };
}

const sectionClass = "rounded-xl border border-slate-200/80 bg-white p-4";
const panelHeaderClass = "mb-3 flex items-center justify-between gap-2";
const actionButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800";
const accentButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-[hsl(var(--accent))] px-4 text-sm font-semibold text-white transition hover:opacity-95";
const cancelButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
const chipClass = "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600";
const formatDate = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const actionLabel: Record<string, string> = {
  BLOODLINE_CREATED: "혈통카드 생성",
  BLOODLINE_TRANSFER: "혈통카드 보내기",
  LINE_CREATED: "라인 생성",
  LINE_ISSUED: "라인 만들기",
  LINE_TRANSFER: "라인 보내기",
  CARD_REVOKED: "카드 철회",
};

const eventToneByAction: Record<string, string> = {
  BLOODLINE_CREATED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  BLOODLINE_TRANSFER: "border-amber-100 bg-amber-50 text-amber-700",
  LINE_CREATED: "border-sky-100 bg-sky-50 text-sky-700",
  LINE_ISSUED: "border-violet-100 bg-violet-50 text-violet-700",
  LINE_TRANSFER: "border-amber-100 bg-amber-50 text-amber-700",
  CARD_REVOKED: "border-rose-100 bg-rose-50 text-rose-700",
};

export default function BloodlineCardDetailClient({ cardId }: BloodlineCardDetailClientProps) {
  const { user } = useUser();
  const searchParams = useSearchParams();

  const {
    data: bloodlineData,
    isLoading,
    mutate: mutateBloodline,
  } = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);

  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [transferDraft, setTransferDraft] = useState<Drafts>({});
  const [issueDraft, setIssueDraft] = useState<Drafts>({});
  const [transferLoading, setTransferLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<BloodlineCardEventsResponse["events"]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const cards = useMemo(() => {
    if (!bloodlineData) return [] as BloodlineCardItem[];
    const allCards = [
      ...(bloodlineData.myBloodlines || []),
      ...(bloodlineData.receivedBloodlines || []),
      ...(bloodlineData.createdLines || []),
      ...(bloodlineData.receivedLines || []),
      ...(bloodlineData.ownedCards || []),
    ];
    return Array.from(new Map(allCards.map((card) => [card.id, card])).values());
  }, [bloodlineData]);

  const card = useMemo(() => cards.find((item) => item.id === cardId), [cards, cardId]);

  const isCurrentOwner = card?.currentOwner.id === user?.id;
  const isBloodline = card?.cardType === "BLOODLINE";
  const canTransfer = Boolean(
    card && (isBloodline ? card.creator.id === user?.id && isCurrentOwner : isCurrentOwner)
  );
  const canIssue = Boolean(card && isCurrentOwner && isBloodline);

  useEffect(() => {
    if (!user?.id || !card) {
      setEvents([]);
      return;
    }

    let active = true;
    const load = async () => {
      setEventsLoading(true);
      try {
        const response = await fetch(`/api/bloodline-cards/${cardId}/events?limit=12`);
        const payload = (await response.json()) as BloodlineCardEventsResponse;
        if (!active) return;
        setEvents(payload.success ? payload.events : []);
      } finally {
        if (active) setEventsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [cardId, card, user?.id]);

  useEffect(() => {
    const requested = searchParams?.get("action") as ActiveAction;
    if (!requested || requested !== "transfer" && requested !== "issue") return;
    if (requested === "transfer" && !canTransfer) return;
    if (requested === "issue" && !canIssue) return;
    setActiveAction(requested);
  }, [searchParams, canTransfer, canIssue]);

  if (isLoading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!card) {
    return (
      <section className="app-page">
        <div className="mx-auto w-full max-w-[680px] rounded-xl border border-slate-200 bg-white p-5">
          <h1 className="text-lg font-black text-slate-900">카드를 찾을 수 없습니다.</h1>
          <p className="mt-1 text-sm text-slate-600">
            카드 ID가 없거나 열람 권한이 없을 수 있습니다.
          </p>
          <Link
            href="/bloodline-management"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            혈통관리로 이동
          </Link>
        </div>
      </section>
    );
  }

  const handleTransferSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!card || !user?.id) return;

    const toUserName = String(transferDraft[card.id]?.toUserName || "").trim();
    const note = String(transferDraft[card.id]?.note || "").trim();
    if (!toUserName) {
      setError("받는 사람 닉네임을 입력해주세요.");
      return;
    }

    setError("");
    setMessage("");
    setTransferLoading(true);

    try {
      const response = await fetch(`/api/bloodline-cards/${card.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, toUserName, note }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "카드 보내기 요청에 실패했습니다.");
      }

      setMessage("카드 보내기 요청이 완료되었습니다.");
      setActiveAction(null);
      setTransferDraft((prev) => ({ ...prev, [card.id]: { toUserName: "", note: "" } }));
      await mutateBloodline();
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : "카드 보내기 중 오류가 발생했습니다."
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleIssueSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!card || !user?.id) return;

    const lineName = String(issueDraft[card.id]?.lineName || "").trim();

    setError("");
    setMessage("");
    setIssueLoading(true);

    try {
      const response = await fetch(`/api/bloodline-cards/${card.id}/issue-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lineName }),
      });
      const payload = (await response.json()) as BloodlineCardIssueLineResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "라인 만들기에 실패했습니다.");
      }

      setMessage(`라인 카드 발급 완료: ${payload.card?.name || "요청한 라인"}`);
      setActiveAction(null);
      setIssueDraft((prev) => ({ ...prev, [card.id]: { lineName: "" } }));
      await mutateBloodline();
    } catch (issueError) {
      setError(
        issueError instanceof Error ? issueError.message : "라인 만들기 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIssueLoading(false);
    }
  };

  return (
    <section className="app-page min-h-screen">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
        <div className={sectionClass}>
          <div className={panelHeaderClass}>
            <Link
              href="/bloodline-management"
              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              목록으로
            </Link>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
              {isBloodline ? "혈통카드" : "라인카드"}
            </span>
          </div>

          <h1 className="app-title-lg text-slate-900">{card.name}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {card.description || "설명이 없습니다."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={chipClass}>현재 상태 {card.status}</span>
            <span className={chipClass}>발급 {card.transfers.length}회</span>
            <span className={chipClass}>ID #{card.id}</span>
          </div>
        </div>

        <article className={sectionClass}>
          <div className={panelHeaderClass}>
            <h2 className="text-sm font-bold text-slate-900">카드 미리보기</h2>
          </div>
          <BloodlineVisualCard
            cardId={card.id}
            name={card.name}
            ownerName={card.currentOwner.name}
            subtitle={card.description || "설명이 없습니다."}
            image={card.image}
            variant={card.visualStyle}
          />
        </article>

        <article className={sectionClass}>
          <div className={panelHeaderClass}>
            <h2 className="text-sm font-bold text-slate-900">기본 정보</h2>
          </div>
            <div className="grid gap-2">
            <p className={chipClass}>제작자: {card.creator.name}</p>
            <p className={chipClass}>현재 보유자: {card.currentOwner.name}</p>
          </div>
        </article>

        <article className={sectionClass}>
          <div className={panelHeaderClass}>
            <h2 className="text-sm font-bold text-slate-900">바로 실행</h2>
          </div>

          {canTransfer || canIssue ? (
            <div className="space-y-2">
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {message}
                </p>
              ) : null}
              {activeAction === "transfer" ? (
                <form className="space-y-2" onSubmit={handleTransferSubmit}>
                  <Input
                    value={transferDraft[card.id]?.toUserName || ""}
                    onChange={(event) =>
                      setTransferDraft((prev) => ({
                        ...prev,
                        [card.id]: {
                          ...prev[card.id],
                          toUserName: event.target.value,
                        },
                      }))
                    }
                    placeholder="보내는 상대 닉네임(필수)"
                    className="h-11 rounded-lg"
                  />
                  <Input
                    value={transferDraft[card.id]?.note || ""}
                    onChange={(event) =>
                      setTransferDraft((prev) => ({
                        ...prev,
                        [card.id]: {
                          ...prev[card.id],
                          note: event.target.value,
                        },
                      }))
                    }
                    placeholder="메모 (선택)"
                    className="h-11 rounded-lg"
                  />
                  <div className="grid gap-2">
                    <Button type="submit" className={actionButtonClass} disabled={transferLoading}>
                      {transferLoading ? "처리 중..." : "확인"}
                    </Button>
                    <Button
                      type="button"
                      className={cancelButtonClass}
                      onClick={() => setActiveAction(null)}
                      disabled={transferLoading}
                    >
                      취소
                    </Button>
                  </div>
                </form>
              ) : activeAction === "issue" ? (
                <form className="space-y-2" onSubmit={handleIssueSubmit}>
                  <Input
                    value={issueDraft[card.id]?.lineName || ""}
                    onChange={(event) =>
                      setIssueDraft((prev) => ({
                        ...prev,
                        [card.id]: {
                          ...prev[card.id],
                          lineName: event.target.value,
                        },
                      }))
                    }
                    placeholder="라인 이름(선택)"
                    className="h-11 rounded-lg"
                  />
                  <div className="grid gap-2">
                    <Button type="submit" className={accentButtonClass} disabled={issueLoading}>
                      {issueLoading ? "처리 중..." : "확인"}
                    </Button>
                    <Button
                      type="button"
                      className={cancelButtonClass}
                      onClick={() => setActiveAction(null)}
                      disabled={issueLoading}
                    >
                      취소
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-2">
                  {canTransfer ? (
                    <Button
                      type="button"
                      className={actionButtonClass}
                      onClick={() => setActiveAction("transfer")}
                    >
                      보내기
                    </Button>
                  ) : null}
                  {canIssue ? (
                    <Button
                      type="button"
                      className={accentButtonClass}
                      onClick={() => setActiveAction("issue")}
                    >
                      라인 만들기
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">현재 내가 바로 진행할 수 있는 액션이 없습니다.</p>
          )}
        </article>

        <article className={sectionClass}>
          <div className={panelHeaderClass}>
            <h2 className="text-sm font-bold text-slate-900">최근 기록</h2>
            <span className="text-xs text-slate-500">총 {events.length}건</span>
          </div>

          {eventsLoading ? (
            <div className="flex h-16 items-center justify-center">
              <Spinner />
            </div>
          ) : events.length ? (
            <div className="space-y-2">
              {events.slice(0, 5).map((record) => (
                <div
                  key={record.id}
                  className={`rounded-lg border p-3 ${eventToneByAction[record.action] || "border-slate-200 bg-slate-50"} text-sm`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{actionLabel[record.action] || record.action}</p>
                    <span className="text-[10px] font-semibold text-slate-700">{record.action}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    {record.actorUser?.name || "시스템"}
                    {record.fromUser ? ` · ${record.fromUser.name} → ${record.toUser?.name || "시스템"}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(record.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              기록이 없습니다.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
