"use client";

/**
 * 혈통카드 상세 — 당근 톤(A안)
 * 원본: bredy_app src/app/bloodline-management/card/[cardId].tsx
 *
 * 헤더(뒤로 + 제목 18/700) → 상단 카드(BloodlineVisualCard)
 * → 8px 갭 + "카드 정보" 표(라벨 14 muted · 값 15, 1px line 행)
 * → 8px 갭 + "양도 이력" 플랫 리스트 → 안내/폼 → 하단 고정 바(라인 만들기 surface / 카드 보내기 주황 52).
 */
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { authFetch } from "@libs/client/authFetch";
import { fetchBloodlineCardEvents } from "@libs/client/bloodlineCardEvents";
import Layout from "@components/features/MainLayout";
import { Input } from "@components/ui/input";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineHeader,
  BloodlinePrimaryButton,
  BloodlineSecondaryButton,
  BloodlineSpinner,
  bloodlineInputClass,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import {
  bloodlineCardMeta,
  bloodlineCardTypeLabel,
  formatBloodlineEventTime,
  type BloodlineCardDetailResponse,
  type BloodlineCardEventItem,
  type BloodlineCardIssueLineResponse,
} from "@libs/shared/bloodline-card";

type ActiveAction = "transfer" | "issue" | null;

interface TransferUserItem {
  id: number;
  name: string;
}

const actionLabel: Record<string, string> = {
  BLOODLINE_CREATED: "혈통카드 생성",
  BLOODLINE_TRANSFER: "혈통카드 보내기",
  LINE_CREATED: "라인 생성",
  LINE_ISSUED: "라인 만들기",
  LINE_TRANSFER: "라인 보내기",
  CARD_REVOKED: "카드 철회",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "사용 중",
  INACTIVE: "비활성",
  REVOKED: "철회됨",
  TRANSFERRED: "양도됨",
};

function SectionGap() {
  return <div className="mt-5 h-2 bg-app-gap" />;
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h2 className="px-4 pb-2 pt-4 text-[16px] font-bold tracking-[-0.3px] text-app-text">{label}</h2>
  );
}

function InfoRow({
  label,
  value,
  href,
  first,
}: {
  label: string;
  value: string;
  href?: string;
  first: boolean;
}) {
  const rowClass = `flex items-center justify-between gap-3 px-4 py-[13px] ${
    first ? "" : "border-t border-app-line"
  }`;
  const body = (
    <>
      <span className="shrink-0 text-[14px] tracking-[-0.2px] text-app-muted">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-[15px] tracking-[-0.2px] text-app-text ${
          href ? "font-semibold" : ""
        }`}
      >
        {value}
      </span>
    </>
  );
  if (!href) return <div className={rowClass}>{body}</div>;
  return (
    <Link href={href} aria-label={`${label} ${value}`} className={`${rowClass} hover:bg-app-surface`}>
      {body}
    </Link>
  );
}

function HistoryRow({ record, first }: { record: BloodlineCardEventItem; first: boolean }) {
  const who = record.actorUser?.name ?? "시스템";
  const flow = record.toUser ? `${record.fromUser?.name ?? who} → ${record.toUser.name}` : who;
  const sub = [flow, record.note].filter(Boolean).join(" · ");
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 ${first ? "" : "border-t border-app-line"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.2px] text-app-text">
          {actionLabel[record.action] ?? record.action}
        </p>
        <p className="mt-[3px] truncate text-[13px] tracking-[-0.2px] text-app-muted">{sub}</p>
      </div>
      <span className="shrink-0 text-[13px] tracking-[-0.2px] text-app-muted">
        {formatBloodlineEventTime(record.createdAt)}
      </span>
    </div>
  );
}

function Notice({ tone, message }: { tone: "error" | "success"; message: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mx-4 mt-3 rounded-md bg-app-gap px-3 py-2.5 text-[14px] tracking-[-0.2px] ${
        tone === "error" ? "text-app-brand" : "text-app-text"
      }`}
    >
      {message}
    </p>
  );
}

function FieldLabel({ label, htmlFor }: { label: string; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[15px] font-semibold tracking-[-0.2px] text-app-text"
    >
      {label}
    </label>
  );
}

export default function BloodlineCardDetailClient({ cardId }: { cardId: number }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    data: detailData,
    error: detailError,
    isLoading,
    mutate: mutateCard,
  } = useSWR<BloodlineCardDetailResponse>(`/api/bloodline-cards/${cardId}`, {
    shouldRetryOnError: false,
  });

  const card = detailData?.card || null;
  const bloodlineSourceCard = detailData?.bloodlineSourceCard || null;
  const parentLineCard = detailData?.parentLineCard || null;

  const isBloodline = card?.cardType === "BLOODLINE";
  const isOwnedByMe = card?.isOwnedByMe ?? card?.currentOwner.id === user?.id;
  const canTransfer = Boolean(card && isOwnedByMe);
  const canIssue = Boolean(card && isOwnedByMe && isBloodline);

  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [toUserName, setToUserName] = useState("");
  const [toUserId, setToUserId] = useState<number | undefined>(undefined);
  const [transferNote, setTransferNote] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [candidates, setCandidates] = useState<TransferUserItem[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [lineName, setLineName] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [events, setEvents] = useState<BloodlineCardEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [missingCardRetryCount, setMissingCardRetryCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationName, setCelebrationName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── 이력 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!card) {
      setEvents([]);
      return;
    }
    let active = true;
    const load = async () => {
      setEventsLoading(true);
      try {
        const loaded = await fetchBloodlineCardEvents(cardId, 12);
        if (active) setEvents(loaded);
      } catch {
        if (active) setEvents([]);
      } finally {
        if (active) setEventsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [cardId, card]);

  const lineageTransferHint = useMemo(() => {
    if (!card || card.cardType !== "LINE" || !user?.id) return null;
    const incoming = events.find(
      (event) =>
        (event.action === "LINE_ISSUED" || event.action === "LINE_TRANSFER") &&
        event.toUser?.id === user.id
    );
    if (!incoming) return null;
    const sourceName = incoming.fromUser?.name ?? incoming.actorUser?.name ?? "알 수 없음";
    return `${sourceName}님에게 받음`;
  }, [card, events, user?.id]);

  // ── ?action=transfer|issue 로 바로 폼 열기 ──────────────────────────
  useEffect(() => {
    const requested = searchParams?.get("action");
    if (requested === "transfer" && canTransfer) setActiveAction("transfer");
    if (requested === "issue" && canIssue) setActiveAction("issue");
  }, [searchParams, canTransfer, canIssue]);

  // ── 생성 축하 모달 ──────────────────────────────────────────────────
  const celebration = searchParams?.get("celebration");
  useEffect(() => {
    if (celebration !== "card-created") {
      setShowCelebration(false);
      return;
    }
    const raw = searchParams?.get("name") || card?.name || "";
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    setCelebrationName(decoded);
    setShowCelebration(true);
  }, [celebration, card?.name, searchParams]);

  const closeCelebration = () => {
    setShowCelebration(false);
    const next = new URLSearchParams(searchParams?.toString() || "");
    next.delete("celebration");
    next.delete("name");
    const query = next.toString();
    const base = pathname ?? "/";
    router.replace(query ? `${base}?${query}` : base);
  };

  // ── 생성 직후 동기화 지연 대비: 600ms 간격 2회 재시도 ─────────────────
  useEffect(() => {
    if (isLoading) return;
    if (card) {
      setMissingCardRetryCount(0);
      return;
    }
    if (missingCardRetryCount >= 2) return;
    const timeoutId = setTimeout(async () => {
      await mutateCard().catch(() => undefined);
      setMissingCardRetryCount((prev) => prev + 1);
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [card, isLoading, missingCardRetryCount, mutateCard]);

  // ── 받는 사람 검색(디바운스 200ms) ───────────────────────────────────
  useEffect(() => {
    const keyword = toUserName.trim();
    if (activeAction !== "transfer" || toUserId || keyword.length < 1) {
      setCandidatesLoading(false);
      setCandidates([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setCandidatesLoading(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(keyword)}&limit=8`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as { success: boolean; users?: TransferUserItem[] };
        if (controller.signal.aborted) return;
        setCandidates(response.ok && payload.success ? payload.users || [] : []);
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
        setCandidates([]);
      } finally {
        if (!controller.signal.aborted) setCandidatesLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [activeAction, toUserName, toUserId]);

  // ── 핸들러 ──────────────────────────────────────────────────────────
  const openAction = (action: Exclude<ActiveAction, null>) => {
    setErrorMsg("");
    setSuccessMsg("");
    setActiveAction(action);
  };

  const cancelAction = () => {
    setActiveAction(null);
    setErrorMsg("");
    setSuccessMsg("");
    setToUserName("");
    setToUserId(undefined);
    setTransferNote("");
    setLineName("");
    setCandidates([]);
  };

  const selectCandidate = (item: TransferUserItem) => {
    setToUserName(item.name);
    setToUserId(item.id);
    setCandidates([]);
  };

  const submitTransfer = async () => {
    if (!card || !user?.id) return;
    const name = toUserName.trim();
    if (!name) {
      setErrorMsg("받는 사람 닉네임을 입력해주세요.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setTransferLoading(true);
    try {
      const response = await authFetch(`/api/bloodline-cards/${card.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          toUserName: name,
          toUserId,
          note: transferNote.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "카드 보내기 요청에 실패했습니다.");
      }
      setSuccessMsg("카드 보내기 요청이 완료되었습니다.");
      setActiveAction(null);
      setToUserName("");
      setToUserId(undefined);
      setTransferNote("");
      setCandidates([]);
      await mutateCard();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "카드 보내기 중 오류가 발생했습니다.");
    } finally {
      setTransferLoading(false);
    }
  };

  const submitIssue = async () => {
    if (!card || !user?.id) return;
    setErrorMsg("");
    setSuccessMsg("");
    setIssueLoading(true);
    try {
      const response = await authFetch(`/api/bloodline-cards/${card.id}/issue-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lineName.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as BloodlineCardIssueLineResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "라인 만들기에 실패했습니다.");
      }
      setSuccessMsg(`라인 카드 발급 완료: ${payload.card?.name || "요청한 라인"}`);
      setActiveAction(null);
      setLineName("");
      await mutateCard();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "라인 만들기 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIssueLoading(false);
    }
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeAction === "transfer") void submitTransfer();
    else if (activeAction === "issue") void submitIssue();
  };

  // ── 로딩 ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout headerVariant="none" seoTitle="혈통카드">
        <BloodlineHeader title="혈통카드" />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  // ── 카드 없음 / 오류 ────────────────────────────────────────────────
  if (!card) {
    const isWaitingForSync = missingCardRetryCount < 2;
    const status = (detailError as (Error & { status?: number }) | undefined)?.status;
    const isNotFound = status === 404 || status === 403;
    if (!isWaitingForSync && detailError && !detailData && !isNotFound) {
      return (
        <Layout headerVariant="none" seoTitle="혈통카드">
          <BloodlineHeader title="혈통카드" />
          <div className="flex min-h-[60vh] items-center justify-center px-4">
            <QueryErrorState
              title="카드 정보를 불러오지 못했어요"
              onRetry={() => void mutateCard()}
            />
          </div>
        </Layout>
      );
    }
    return (
      <Layout headerVariant="none" seoTitle="혈통카드">
        <BloodlineHeader title="혈통카드" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          {isWaitingForSync ? (
            <>
              <BloodlineSpinner />
              <p className="mt-3 text-[14px] tracking-[-0.2px] text-app-muted">
                카드 정보를 불러오는 중이에요.
              </p>
            </>
          ) : (
            <p className="text-[14px] tracking-[-0.2px] text-app-muted">
              카드를 찾을 수 없어요. 비활성화된 카드일 수 있어요.
            </p>
          )}
        </div>
        {!isWaitingForSync ? (
          <BloodlineBottomBar>
            <BloodlinePrimaryButton href="/bloodline-management">혈통관리로 이동</BloodlinePrimaryButton>
          </BloodlineBottomBar>
        ) : null}
      </Layout>
    );
  }

  const infoRows: { label: string; value: string; href?: string }[] = [
    { label: "제작자", value: card.creator.name, href: `/profiles/${card.creator.id}` },
    { label: "현재 보유자", value: card.currentOwner.name, href: `/profiles/${card.currentOwner.id}` },
    { label: "상태", value: statusLabel[card.status] ?? card.status },
    // transfers 는 생성 기록을 포함하고 최근 몇 건만 내려오므로 서버 transferCount 를 쓴다.
    { label: "발급 횟수", value: `${card.transferCount ?? 0}회` },
    { label: "카드 번호", value: `#${card.id}` },
  ];
  if (card.cardType === "LINE") {
    infoRows.push({
      label: "원본 혈통",
      value: bloodlineSourceCard
        ? bloodlineSourceCard.name
        : card.bloodlineReferenceId
          ? `#${card.bloodlineReferenceId}`
          : "-",
      href: bloodlineSourceCard ? `/bloodline-management/card/${bloodlineSourceCard.id}` : undefined,
    });
    infoRows.push({
      label: "상위 라인",
      value: parentLineCard
        ? parentLineCard.name
        : card.parentCardId
          ? `#${card.parentCardId}`
          : "직접 파생 없음",
      href: parentLineCard ? `/bloodline-management/card/${parentLineCard.id}` : undefined,
    });
  }
  if (lineageTransferHint) infoRows.push({ label: "수신 경로", value: lineageTransferHint });

  const showActionBar = (canTransfer || canIssue) && activeAction === null;
  const busy = transferLoading || issueLoading;
  const title = isBloodline ? "혈통카드" : "라인카드";

  return (
    <Layout headerVariant="none" seoTitle={card.name}>
      <BloodlineHeader title={title} />

      {showCelebration ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-app-overlay px-6"
          onClick={closeCelebration}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bloodline-celebration-title"
            className="w-full max-w-sm rounded-xl bg-app-elevated px-5 pb-4 pt-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="bloodline-celebration-title"
              className="text-center text-[18px] font-bold tracking-[-0.3px] text-app-text"
            >
              {celebrationName || "혈통카드"} 완성!
            </p>
            <p className="mt-2 text-center text-[14px] tracking-[-0.2px] text-app-muted">
              화면을 캡쳐해서 친구들에게 공유해보세요.
            </p>
            <div className="mt-5 flex">
              <BloodlinePrimaryButton onClick={closeCelebration}>확인</BloodlinePrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      <form id="bloodline-action-form" onSubmit={handleFormSubmit}>
        <div className="px-4 pt-3.5">
          <BloodlineVisualCard
            cardId={card.id}
            name={card.name}
            subtitle={bloodlineCardMeta(card)}
            ownerName={card.currentOwner.name}
            typeLabel={bloodlineCardTypeLabel(card.cardType)}
            issuedAt={card.createdAt}
            image={card.image}
          />
        </div>

        <SectionGap />
        <SectionTitle label="카드 정보" />
        <div>
          {infoRows.map((row, index) => (
            <InfoRow key={row.label} {...row} first={index === 0} />
          ))}
        </div>

        <SectionGap />
        <SectionTitle label="양도 이력" />
        {eventsLoading ? (
          <div className="flex justify-center py-8">
            <BloodlineSpinner />
          </div>
        ) : events.length > 0 ? (
          <div>
            {events.slice(0, 8).map((record, index) => (
              <HistoryRow key={record.id} record={record} first={index === 0} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[14px] tracking-[-0.2px] text-app-muted">
            아직 이력이 없어요.
          </p>
        )}

        {errorMsg ? <Notice tone="error" message={errorMsg} /> : null}
        {successMsg ? <Notice tone="success" message={successMsg} /> : null}

        {!canTransfer && !canIssue ? (
          <p className="px-4 pt-5 text-[14px] tracking-[-0.2px] text-app-muted">
            이 카드는 {card.currentOwner.name}님이 보유 중이에요. 보내기와 라인 만들기는 보유자만 할
            수 있어요.
          </p>
        ) : null}

        {activeAction === "transfer" ? (
          <div className="px-4 pt-5">
            <FieldLabel label="받는 사람" htmlFor="bloodline-transfer-to" />
            <Input
              id="bloodline-transfer-to"
              value={toUserName}
              onChange={(event) => {
                setToUserName(event.target.value);
                setToUserId(undefined);
              }}
              placeholder="닉네임을 입력해주세요"
              autoComplete="off"
              disabled={transferLoading}
              className={bloodlineInputClass}
            />
            {candidatesLoading || candidates.length > 0 ? (
              <div className="mt-1.5 overflow-hidden rounded-lg border border-app-border bg-app-elevated">
                {candidatesLoading ? (
                  <p className="px-3.5 py-3 text-[14px] text-app-muted">검색 중...</p>
                ) : (
                  candidates.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectCandidate(item)}
                      className={`block w-full px-3.5 py-3 text-left text-[15px] text-app-text hover:bg-app-surface ${
                        index === 0 ? "" : "border-t border-app-line"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
            <div className="mt-4">
              <FieldLabel label="메모" htmlFor="bloodline-transfer-note" />
              <Input
                id="bloodline-transfer-note"
                value={transferNote}
                onChange={(event) => setTransferNote(event.target.value)}
                placeholder="메모를 남겨보세요 (선택)"
                disabled={transferLoading}
                className={bloodlineInputClass}
              />
            </div>
          </div>
        ) : null}

        {activeAction === "issue" ? (
          <div className="px-4 pt-5">
            <FieldLabel label="라인 이름" htmlFor="bloodline-line-name" />
            <Input
              id="bloodline-line-name"
              value={lineName}
              onChange={(event) => setLineName(event.target.value)}
              placeholder="라인 이름을 입력해주세요 (선택)"
              disabled={issueLoading}
              className={bloodlineInputClass}
            />
          </div>
        ) : null}

        <div className="h-8" />
      </form>

      {showActionBar || activeAction !== null ? <BloodlineBottomBarSpacer /> : null}

      {showActionBar ? (
        <BloodlineBottomBar>
          {canIssue ? (
            <BloodlineSecondaryButton onClick={() => openAction("issue")}>
              라인 만들기
            </BloodlineSecondaryButton>
          ) : null}
          {canTransfer ? (
            <BloodlinePrimaryButton onClick={() => openAction("transfer")}>
              카드 보내기
            </BloodlinePrimaryButton>
          ) : null}
        </BloodlineBottomBar>
      ) : null}

      {activeAction !== null ? (
        <BloodlineBottomBar>
          <BloodlineSecondaryButton onClick={cancelAction} disabled={busy}>
            취소
          </BloodlineSecondaryButton>
          <BloodlinePrimaryButton
            onClick={() => (activeAction === "transfer" ? void submitTransfer() : void submitIssue())}
            disabled={busy}
          >
            {activeAction === "transfer"
              ? transferLoading
                ? "보내는 중..."
                : "카드 보내기"
              : issueLoading
                ? "만드는 중..."
                : "라인 만들기"}
          </BloodlinePrimaryButton>
        </BloodlineBottomBar>
      ) : null}
    </Layout>
  );
}
