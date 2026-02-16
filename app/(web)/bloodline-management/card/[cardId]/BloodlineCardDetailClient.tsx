"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Spinner } from "@components/atoms/Spinner";
import useUser from "hooks/useUser";
import { toast } from "react-toastify";
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
    toUserId?: number;
    note?: string;
    lineName?: string;
  };
}

interface TransferUserItem {
  id: number;
  name: string;
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
  const [transferCandidates, setTransferCandidates] = useState<TransferUserItem[]>([]);
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

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

  const isOwnedByMe = card?.isOwnedByMe ?? card?.currentOwner.id === user?.id;
  const isBloodline = card?.cardType === "BLOODLINE";
  const canTransfer = Boolean(card && isOwnedByMe);
  const canIssue = Boolean(card && isOwnedByMe && isBloodline);

  const bloodlineSourceCard = useMemo(() => {
    if (!card?.bloodlineReferenceId) return null;
    return cards.find((item) => item.id === card.bloodlineReferenceId) || null;
  }, [cards, card]);

  const parentLineCard = useMemo(() => {
    if (!card?.parentCardId) return null;
    return cards.find((item) => item.id === card.parentCardId) || null;
  }, [cards, card]);

  const lineageTransferHint = useMemo(() => {
    if (!card || card.cardType !== "LINE" || !user?.id) {
      return null;
    }

    const incoming = events.find(
      (event) =>
        (event.action === "LINE_ISSUED" || event.action === "LINE_TRANSFER") &&
        event.toUser?.id === user.id
    );

    if (!incoming) return null;

    const sourceName =
      incoming.fromUser?.name || incoming.actorUser?.name || "알 수 없음";
    return `${sourceName}로부터 최근 수신`;
  }, [card, events, user?.id]);

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
    const toUserId = transferDraft[card.id]?.toUserId;
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
        body: JSON.stringify({ cardId: card.id, toUserName, toUserId, note }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "카드 보내기 요청에 실패했습니다.");
      }

      setMessage("카드 보내기 요청이 완료되었습니다.");
      setActiveAction(null);
      setTransferDraft((prev) => ({
        ...prev,
        [card.id]: { toUserName: "", toUserId: undefined, note: "" },
      }));
      setTransferCandidates([]);
      await mutateBloodline();
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : "카드 보내기 중 오류가 발생했습니다."
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferCandidateSelect = (user: TransferUserItem) => {
    if (!card) return;

    setTransferDraft((prev) => ({
      ...prev,
      [card.id]: {
        ...prev[card.id],
        toUserName: user.name,
        toUserId: user.id,
      },
    }));
    setTransferCandidates([]);
  };

  useEffect(() => {
    const inputKeyword = String(transferDraft[card?.id || 0]?.toUserName || "").trim();
    const selectedUserId = transferDraft[card?.id || 0]?.toUserId;

    if (activeAction !== "transfer" || !card) {
      setTransferSearchLoading(false);
      setTransferCandidates([]);
      return;
    }

    if (selectedUserId) {
      setTransferSearchLoading(false);
      setTransferCandidates([]);
      return;
    }

    if (inputKeyword.length < 1) {
      setTransferSearchLoading(false);
      setTransferCandidates([]);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const keyword = inputKeyword;

    searchDebounceRef.current = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setTransferSearchLoading(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(keyword)}&limit=8`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as {
          success: boolean;
          users?: TransferUserItem[];
        };
        if (!activeAction || !card) return;
        if (keyword !== String(transferDraft[card.id]?.toUserName || "").trim()) return;
        if (transferDraft[card.id]?.toUserId) return;
        if (response.ok && payload.success) {
          setTransferCandidates(payload.users || []);
        } else {
          setTransferCandidates([]);
        }
      } catch (candidateError) {
        if ((candidateError as DOMException).name === "AbortError") return;
        setTransferCandidates([]);
      } finally {
        if (activeAction === "transfer" && card) {
          setTransferSearchLoading(false);
        }
      }
    }, 200);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchAbortRef.current?.abort();
    };
  }, [activeAction, card?.id, transferDraft[card?.id || 0]?.toUserName, transferDraft[card?.id || 0]?.toUserId]);

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

  const getCardShareUrl = () => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopyCardLink = async () => {
    try {
      const url = getCardShareUrl();
      if (!url) {
        toast.error("공유 링크를 생성하지 못했습니다.");
        return;
      }

      await copyToClipboard(url);
      toast.success("혈통카드 링크가 복사되었습니다.");
    } catch {
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  const handleShareCard = async () => {
    try {
      const url = getCardShareUrl();
      if (!url) {
        toast.error("공유 링크를 생성하지 못했습니다.");
        return;
      }

      const shareText = `${card?.name || "혈통 카드"} 혈통카드를 확인해보세요`;

      if (navigator.share) {
        await navigator.share({
          title: card?.name || "혈통카드",
          text: shareText,
          url,
        });
        toast.success("공유를 완료했습니다.");
        return;
      }

      await copyToClipboard(`${shareText}\n${url}`);
      toast.info("이 기기에서는 바로 공유를 지원하지 않아 링크를 복사했습니다.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("공유에 실패했습니다.");
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
          {lineageTransferHint ? (
            <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
              {lineageTransferHint}
            </p>
          ) : null}
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
            {card.cardType === "LINE" ? (
              <>
                <div className={chipClass}>
                  원본 혈통: {bloodlineSourceCard ? (
                    <Link
                      href={`/bloodline-management/card/${bloodlineSourceCard.id}`}
                      className="font-semibold text-slate-900 underline underline-offset-4"
                    >
                      #{bloodlineSourceCard.id} {bloodlineSourceCard.name}
                    </Link>
                  ) : (
                    `#${card.bloodlineReferenceId}`
                  )}
                </div>
                <div className={chipClass}>
                  상위 라인: {parentLineCard ? (
                    <Link
                      href={`/bloodline-management/card/${parentLineCard.id}`}
                      className="font-semibold text-slate-900 underline underline-offset-4"
                    >
                      #{parentLineCard.id} {parentLineCard.name}
                    </Link>
                  ) : card.parentCardId ? (
                    `#${card.parentCardId}`
                  ) : (
                    "직접 파생 없음"
                  )}
                </div>
              </>
              ) : null}
          </div>
        </article>

        <article className={sectionClass}>
          <div className={panelHeaderClass}>
            <h2 className="text-sm font-bold text-slate-900">공유하기</h2>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            카드 상세를 SNS에 공유하거나 링크를 복사해 나의 혈통카드를 자랑해보세요.
          </p>
          <div className="grid gap-2">
            <Button type="button" className={actionButtonClass} onClick={handleCopyCardLink}>
              링크 복사
            </Button>
            <Button type="button" className={accentButtonClass} onClick={handleShareCard}>
              공유하기
            </Button>
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
                  <div className="relative">
                    <Input
                      value={transferDraft[card.id]?.toUserName || ""}
                      onChange={(event) =>
                        setTransferDraft((prev) => ({
                          ...prev,
                          [card.id]: {
                            ...prev[card.id],
                            toUserName: event.target.value,
                            toUserId: undefined,
                          },
                        }))
                      }
                      placeholder="보내는 상대 닉네임(필수)"
                      className="h-11 rounded-lg"
                    />
                    {(transferSearchLoading || transferCandidates.length > 0) ? (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md">
                        {transferSearchLoading ? (
                          <p className="px-3 py-2 text-sm text-slate-500">검색 중...</p>
                        ) : transferCandidates.length ? (
                          transferCandidates.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleTransferCandidateSelect(item)}
                              className="w-full px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                            >
                              {item.name}
                            </button>
                          ))
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
                  {record.note ? (
                    <p className="mt-1 text-xs text-slate-500">메모: {record.note}</p>
                  ) : null}
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
