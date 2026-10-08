"use client";

/**
 * 혈통 / 출처 카드 상세 — 기존 웹 톤(A안) 유지, 혈통 v2 계약·문구만 맞춘다(설계 §4.4 WB-3).
 * 원본: bredy_app src/app/bloodline-management/card/[cardId]/index.tsx
 *
 * 헤더(뒤로 + 제목 18/700 + 공유) → 상단 카드(BloodlineVisualCard)
 * → 8px 갭 + 정보 표(라벨 14 muted · 값 15, 1px line 행) → (출처 카드 보유자) 내 닉네임 공개 토글
 * → 8px 갭 + "이력" 플랫 리스트 → 신뢰 고지 → 보내기 폼
 * → 하단 고정 바(혈통 보유자: 출처 카드 보내기 / 출처 카드 보유자: 다음 분에게 보내기).
 * "혈통 넘기기"는 본문 보조 버튼 + danger 확인창. 보내기는 받는 분 필수 + 확인창 → "보냈어요".
 * 가린 사용자(masked)는 "닉네임 비공개"로 그리고 프로필 링크를 걸지 않는다. 오류 문구는 errorCode 먼저.
 */
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { authFetch } from "@libs/client/authFetch";
import { fetchBloodlineCardEvents } from "@libs/client/bloodlineCardEvents";
import { shareOrCopy } from "@libs/client/share";
import { BLOODLINE_LIST_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import { cn } from "@libs/client/utils";
import Layout from "@components/features/MainLayout";
import { Input } from "@components/ui/input";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  BLOODLINE_TRUST_NOTICE,
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineHeader,
  BloodlineHeaderButton,
  BloodlinePrimaryButton,
  BloodlineSecondaryButton,
  BloodlineSpinner,
  ShareIcon,
  bloodlineErrorText,
  bloodlineInputClass,
  bloodlineOriginText,
  bloodlineProfileHref,
  bloodlineSourceReceipt,
  bloodlineUserLabel,
  readBloodlineSendParams,
  resolveBloodlineSendPreset,
  withJosa,
  type BloodlineSendAction,
  type BloodlineSendParams,
} from "@components/features/bloodline/BloodlineScreenParts";
import useConfirmDialog from "hooks/useConfirmDialog";
import useUser from "hooks/useUser";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";
import { BLOODLINE_ERRORS } from "@libs/shared/bloodline-errors";
import {
  bloodlineCardMeta,
  bloodlineCardTypeLabel,
  bloodlineEventSentence,
  bloodlineUserPhrase,
  formatBloodlineEventDate,
  isHiddenBloodlineEvent,
  type BloodlineCardDetailResponse,
  type BloodlineCardEventItem,
  type BloodlineCardIssueLineResponse,
  type BloodlineCardItem,
  type BloodlineCardPatchResponse,
  type BloodlineCardTransferResponse,
  type BloodlineSendSource,
  type BloodlineUserRef,
} from "@libs/shared/bloodline-card";

interface TransferUserItem {
  id: number;
  name: string;
}

type DetailError = Error & { status?: number; errorCode?: string };

const NOTE_MAX_LENGTH = 300;
const RECEIVER_REQUIRED_MESSAGE = BLOODLINE_ERRORS.BLOODLINE_RECEIVER_REQUIRED.message;
/** `?action=send|transfer` 링크로 들어왔는데 지금은 보낼 수 없을 때(그 사이 혈통을 넘겼거나 출처 카드가 없음). */
const SEND_NOT_ALLOWED_MESSAGE = "지금 이 혈통을 보낼 수 없어요";

/** 링크의 toUserId 를 실제 프로필로 확인해 받는 사람을 정한다. 확인하지 못하면 null(빈 폼으로 연다). */
async function fetchSendPreset(
  params: BloodlineSendParams
): Promise<{ id: number; name: string } | null> {
  if (!params.toUserId) return null;
  try {
    const response = await authFetch(`/api/users/${params.toUserId}`);
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      user?: { id?: number; name?: string | null } | null;
    } | null;
    return resolveBloodlineSendPreset(params, payload);
  } catch {
    return null;
  }
}

/** 상세 조회. 오류면 status·errorCode 를 실어 던진다(회수 404 를 문구로 구분하려고). */
async function fetchBloodlineDetail(url: string): Promise<BloodlineCardDetailResponse> {
  const response = await authFetch(url);
  const payload = (await response.json().catch(() => null)) as BloodlineCardDetailResponse | null;
  if (!response.ok || !payload?.success) {
    const error = new Error(bloodlineErrorText(payload, "혈통을 불러오지 못했어요")) as DetailError;
    error.status = response.status;
    error.errorCode = payload?.errorCode;
    throw error;
  }
  return normalizeDeletedUserNames(payload);
}

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
  href?: string | null;
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

/** 이력 한 줄: "도윤파파님에게 보냈어요" / 메모 / "2026.09.12". 가린 사람은 "닉네임 비공개 분". */
function HistoryRow({ record, first }: { record: BloodlineCardEventItem; first: boolean }) {
  const note = record.note?.trim();
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 ${first ? "" : "border-t border-app-line"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.2px] text-app-text">
          {bloodlineEventSentence(record)}
        </p>
        {note ? (
          <p className="mt-[3px] truncate text-[13px] tracking-[-0.2px] text-app-muted">{note}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-[13px] tracking-[-0.2px] text-app-muted">
        {formatBloodlineEventDate(record.createdAt)}
      </span>
    </div>
  );
}

function Notice({ tone, message }: { tone: "error" | "success"; message: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mx-4 mt-3 rounded-md bg-app-gap px-3 py-2.5 text-[14px] tracking-[-0.2px] ${
        tone === "error" ? "text-app-danger" : "text-app-text"
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

/** 설정 화면과 같은 스위치(28×48). */
function NameVisibleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="내 닉네임 공개"
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative ml-3 h-[28px] w-[48px] shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-app-brand" : "bg-app-border"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-card transition-[left]",
          checked ? "left-[23px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

export default function BloodlineCardDetailClient({ cardId }: { cardId: number }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, confirmDialog } = useConfirmDialog();

  const {
    data: detailData,
    error: detailError,
    isLoading,
    mutate: mutateCard,
  } = useSWR<BloodlineCardDetailResponse, DetailError>(
    `/api/bloodline-cards/${cardId}`,
    fetchBloodlineDetail,
    { shouldRetryOnError: false }
  );
  const { mutate: globalMutate, cache: swrCache } = useSWRConfig();
  /** 보내거나 넘기면 혈통관리·마이페이지·이벤트·프로필 혈통 목록을 다시 받는다(앱 invalidateBloodlineLists). */
  const invalidateBloodlineLists = () =>
    revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, BLOODLINE_LIST_KEY_PREFIXES);

  const card = detailData?.card || null;
  const bloodlineSourceCard = detailData?.bloodlineSourceCard || null;
  /** 정보·공유의 기준이 되는 뿌리 혈통(출처 카드를 열었으면 bloodlineSourceCard). */
  const rootCard = card?.cardType === "BLOODLINE" ? card : bloodlineSourceCard;

  const isBloodline = card?.cardType === "BLOODLINE";
  const isOwnedByMe = Boolean(card && (card.isOwnedByMe ?? card.currentOwner.id === user?.id));
  /** 출처 카드 보내기(issue-line): 뿌리 혈통의 지금 보유자만 */
  const canSend = Boolean(card && isOwnedByMe && isBloodline);
  /** 카드 자체 넘기기(transfer): 혈통 넘기기 / 출처 카드 다음 분에게 보내기 */
  const canTransfer = Boolean(card && isOwnedByMe);
  /** 닉네임 공개 토글 대상: 내가 가진 출처 카드(연 카드가 그것이거나, 뿌리를 열었으면 viewerLineCard) */
  const myLineCard: BloodlineCardItem | null =
    card?.cardType === "LINE" && isOwnedByMe ? card : detailData?.viewerLineCard ?? null;

  const [activeAction, setActiveAction] = useState<BloodlineSendAction | null>(null);
  const [toUserName, setToUserName] = useState("");
  const [toUserId, setToUserId] = useState<number | undefined>(undefined);
  const [sendNote, setSendNote] = useState("");
  const [sendSource, setSendSource] = useState<BloodlineSendSource | null>(null);
  const [sending, setSending] = useState(false);
  const [candidates, setCandidates] = useState<TransferUserItem[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [nameVisibleDraft, setNameVisibleDraft] = useState<boolean | null>(null);
  const [nameVisibleSaving, setNameVisibleSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [events, setEvents] = useState<BloodlineCardEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [missingCardRetryCount, setMissingCardRetryCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationName, setCelebrationName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const appliedQueryRef = useRef<string | null>(null);
  /** 링크로 받은 받는 사람을 확인하는 동안 사용자가 직접 입력·선택했으면 덮어쓰지 않는다. */
  const recipientEditedRef = useRef(false);
  /** "지금 이 혈통을 보낼 수 없어요"를 이미 알린 쿼리(같은 링크로 여러 번 띄우지 않는다). */
  const notAllowedQueryRef = useRef<string | null>(null);

  const isRevoked = detailError?.errorCode === "BLOODLINE_REVOKED";

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

  const visibleEvents = useMemo(
    () => events.filter((record) => !isHiddenBloodlineEvent(record.action)),
    [events]
  );

  /** 내가 가진 출처 카드를 누구에게 받았는지("강산님에게 받음" / "닉네임 비공개 분에게 받음"). */
  const receivedFromText = useMemo(() => {
    if (!card || card.cardType !== "LINE" || !isOwnedByMe || !user?.id) return null;
    const incoming = events.find(
      (record) =>
        (record.action === "LINE_ISSUED" || record.action === "LINE_TRANSFER") &&
        record.toUser?.id === user.id
    );
    const from = incoming
      ? incoming.fromUser ?? incoming.actorUser
      : bloodlineSourceReceipt(card).from;
    return `${bloodlineUserPhrase(from)}에게 받음`;
  }, [card, events, isOwnedByMe, user?.id]);

  // ── ?action=send|issue|transfer (&toUserId&toUserName&auctionId) 로 바로 폼 열기 ──
  const queryKey = searchParams?.toString() ?? "";
  /** 뿌리를 열었는데 나는 그 혈통의 출처 카드만 가졌을 때(경매 낙찰자 제안 등) 그 출처 카드 id */
  const holderLineCardId =
    isBloodline && !isOwnedByMe && detailData?.viewerRelation === "holder"
      ? detailData.viewerLineCard?.id ?? null
      : null;
  useEffect(() => {
    if (!card || appliedQueryRef.current === queryKey) return;
    const params = readBloodlineSendParams(searchParams);
    if (!params.action) return;
    if (params.action === "send" && !canSend && holderLineCardId) {
      // 출처 카드만 가진 판매자는 "다음 분에게 보내기"로 낙찰자에게 그 카드를 넘긴다(앱 낙찰자 제안과 같은 동작)
      appliedQueryRef.current = queryKey;
      const next = new URLSearchParams(queryKey);
      next.set("action", "transfer");
      router.replace(`/bloodline-management/card/${holderLineCardId}?${next.toString()}`);
      return;
    }
    const allowed = params.action === "send" ? canSend : canTransfer;
    if (!allowed) {
      // 낡은 링크(그 사이 혈통을 넘김 등)는 조용히 무시하지 않고 한 번 알린다. 보유 상태가 늦게 확인되면 다시 열 수 있게
      // appliedQueryRef 는 남겨 두지 않는다
      if (user?.id && notAllowedQueryRef.current !== queryKey) {
        notAllowedQueryRef.current = queryKey;
        setErrorMsg(SEND_NOT_ALLOWED_MESSAGE);
      }
      return;
    }
    appliedQueryRef.current = queryKey;
    recipientEditedRef.current = false;
    setErrorMsg((prev) => (prev === SEND_NOT_ALLOWED_MESSAGE ? "" : prev));
    setActiveAction(params.action);
    if (params.auctionId) setSendSource({ type: "auction", auctionId: params.auctionId });
    // 혈통 자체 넘기기는 되돌릴 수 없어 링크로 받는 사람을 채우지 않는다(직접 고른다)
    if (params.action === "transfer" && card.cardType === "BLOODLINE") return;
    if (!params.toUserId) return;
    // 받는 사람은 URL 닉네임이 아니라 toUserId 의 실제 프로필로 채운다(조작한 링크 방지)
    const appliedKey = queryKey;
    void fetchSendPreset(params).then((preset) => {
      if (!preset || appliedQueryRef.current !== appliedKey || recipientEditedRef.current) return;
      setToUserName(preset.name);
      setToUserId(preset.id);
    });
  }, [card, queryKey, searchParams, canSend, canTransfer, holderLineCardId, router, user?.id]);

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

  // ── 생성 직후 동기화 지연 대비: 600ms 간격 2회 재시도(회수된 혈통은 기다리지 않는다) ──
  useEffect(() => {
    if (isLoading) return;
    if (card) {
      setMissingCardRetryCount(0);
      return;
    }
    if (isRevoked || missingCardRetryCount >= 2) return;
    const timeoutId = setTimeout(async () => {
      await mutateCard().catch(() => undefined);
      setMissingCardRetryCount((prev) => prev + 1);
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [card, isLoading, isRevoked, missingCardRetryCount, mutateCard]);

  // ── 받는 분 검색(디바운스 200ms, authFetch 로 Bearer 를 붙인다) ─────────
  useEffect(() => {
    const keyword = toUserName.trim();
    if (activeAction === null || toUserId || keyword.length < 1) {
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
        const response = await authFetch(
          `/api/users/search?q=${encodeURIComponent(keyword)}&limit=8`,
          { signal: controller.signal }
        );
        const payload = (await response.json().catch(() => null)) as {
          success: boolean;
          users?: TransferUserItem[];
        } | null;
        if (controller.signal.aborted) return;
        const users = response.ok && payload?.success ? payload.users || [] : [];
        // 나에게는 보낼 수 없으니 후보에서 뺀다
        setCandidates(users.filter((item) => item.id !== user?.id));
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
  }, [activeAction, toUserName, toUserId, user?.id]);

  // ── 핸들러 ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setToUserName("");
    setToUserId(undefined);
    setSendNote("");
    setSendSource(null);
    setCandidates([]);
  };

  const openAction = (action: BloodlineSendAction) => {
    setErrorMsg("");
    setSuccessMsg("");
    setActiveAction(action);
  };

  const cancelAction = () => {
    setActiveAction(null);
    setErrorMsg("");
    setSuccessMsg("");
    resetForm();
  };

  const selectCandidate = (item: TransferUserItem) => {
    recipientEditedRef.current = true;
    setToUserName(item.name);
    setToUserId(item.id);
    setSendSource({ type: "search" });
    setCandidates([]);
  };

  const submitSend = async () => {
    if (!card || !user?.id || !activeAction || sending) return;
    const name = toUserName.trim();
    if (!name) {
      setErrorMsg(RECEIVER_REQUIRED_MESSAGE);
      return;
    }
    const isIssue = activeAction === "send";
    const isRootTransfer = activeAction === "transfer" && card.cardType === "BLOODLINE";
    const ok = await confirm(
      isRootTransfer
        ? {
            title: "혈통을 넘길까요?",
            description: `혈통 자체가 ${name}님에게 넘어가요. 되돌릴 수 없어요.`,
            confirmText: "넘기기",
            tone: "danger",
          }
        : {
            title: `${name}님에게 ${card.name} 출처 카드를 보낼까요?`,
            description: isIssue
              ? "보내면 되돌릴 수 없어요."
              : "보내면 이 카드는 그분에게 옮겨가요. 되돌릴 수 없어요.",
            confirmText: "보내기",
          }
    );
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");
    setSending(true);
    const note = sendNote.trim();
    const body = {
      toUserName: name,
      toUserId,
      ...(note ? { note } : {}),
      source: sendSource ?? { type: "search" },
    };
    const fallback = isRootTransfer ? "넘기지 못했어요" : "보내지 못했어요";
    try {
      const response = await authFetch(
        `/api/bloodline-cards/${card.id}/${isIssue ? "issue-line" : "transfer"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | BloodlineCardIssueLineResponse
        | BloodlineCardTransferResponse
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(bloodlineErrorText(payload, fallback));
      }
      setSuccessMsg(isRootTransfer ? "넘겼어요" : "보냈어요");
      setActiveAction(null);
      resetForm();
      invalidateBloodlineLists();
      await mutateCard();
    } catch (error) {
      setErrorMsg(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setSending(false);
    }
  };

  const toggleNameVisible = async (lineCard: BloodlineCardItem, next: boolean) => {
    if (nameVisibleSaving) return;
    setErrorMsg("");
    setNameVisibleDraft(next);
    setNameVisibleSaving(true);
    try {
      const response = await authFetch(`/api/bloodline-cards/${lineCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerNameVisible: next }),
      });
      const payload = (await response.json().catch(() => null)) as BloodlineCardPatchResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(bloodlineErrorText(payload, "바꾸지 못했어요"));
      }
      const saved = payload.card ? normalizeDeletedUserNames(payload.card) : null;
      if (saved) {
        // 응답 카드로 캐시를 바꾼다(곧바로 다시 받지 않는다)
        await mutateCard(
          (current) =>
            current
              ? {
                  ...current,
                  card: current.card?.id === saved.id ? saved : current.card,
                  viewerLineCard:
                    current.viewerLineCard?.id === saved.id ? saved : current.viewerLineCard,
                }
              : current,
          { revalidate: false }
        );
      }
      invalidateBloodlineLists();
    } catch (error) {
      setErrorMsg(error instanceof Error && error.message ? error.message : "바꾸지 못했어요");
    } finally {
      setNameVisibleDraft(null);
      setNameVisibleSaving(false);
    }
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeAction) void submitSend();
  };

  // ── 로딩 ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout headerVariant="none" seoTitle="혈통">
        <BloodlineHeader title="혈통" />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  // ── 카드 없음 / 회수 / 오류 ──────────────────────────────────────────
  if (!card) {
    const isWaitingForSync = !isRevoked && missingCardRetryCount < 2;
    const status = detailError?.status;
    const isNotFound = isRevoked || status === 404 || status === 403;
    if (!isWaitingForSync && detailError && !detailData && !isNotFound) {
      return (
        <Layout headerVariant="none" seoTitle="혈통">
          <BloodlineHeader title="혈통" />
          <div className="flex min-h-[60vh] items-center justify-center px-4">
            <QueryErrorState title="혈통을 불러오지 못했어요" onRetry={() => void mutateCard()} />
          </div>
        </Layout>
      );
    }
    return (
      <Layout headerVariant="none" seoTitle="혈통">
        <BloodlineHeader title="혈통" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          {isWaitingForSync ? (
            <>
              <BloodlineSpinner />
              <p className="mt-3 text-[14px] tracking-[-0.2px] text-app-muted">
                혈통 정보를 불러오는 중이에요.
              </p>
            </>
          ) : (
            <p className="text-[14px] tracking-[-0.2px] text-app-muted">
              {isRevoked
                ? BLOODLINE_ERRORS.BLOODLINE_REVOKED.message
                : BLOODLINE_ERRORS.BLOODLINE_NOT_FOUND.message}
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

  const typeLabel = bloodlineCardTypeLabel(card.cardType);
  const creator: BloodlineUserRef = rootCard?.creator ?? card.creator;
  const originText = bloodlineOriginText(rootCard ?? card);
  const infoRows: { label: string; value: string; href?: string | null }[] = [
    { label: "만든 사람", value: bloodlineUserLabel(creator), href: bloodlineProfileHref(creator) },
    {
      label: "현재 보유자",
      value: bloodlineUserLabel(card.currentOwner),
      href: bloodlineProfileHref(card.currentOwner),
    },
  ];
  if (card.cardType === "LINE" && bloodlineSourceCard) {
    infoRows.push({
      label: "혈통",
      value: bloodlineSourceCard.name,
      href: `/bloodline-management/card/${bloodlineSourceCard.id}`,
    });
  }
  if (originText) infoRows.push({ label: "산지", value: originText });
  if (isBloodline && typeof card.receivedCount === "number") {
    infoRows.push({ label: "받은 사람", value: `${card.receivedCount}명` });
  }
  // 혈통은 출처 카드를 보낸 수(issueCount), 출처 카드는 다음 분에게 넘긴 수(transferCount)
  infoRows.push({
    label: "보낸 횟수",
    value: `${(isBloodline ? card.issueCount : card.transferCount) ?? 0}회`,
  });
  if (receivedFromText) infoRows.push({ label: "받은 경로", value: receivedFromText });
  if (isBloodline && myLineCard && myLineCard.id !== card.id) {
    infoRows.push({
      label: "내 출처 카드",
      value: "보기",
      href: `/bloodline-management/card/${myLineCard.id}`,
    });
  }

  const nameVisible = nameVisibleDraft ?? Boolean(myLineCard?.ownerNameVisible);
  const showActionBar = canTransfer && activeAction === null;
  const isRootTransferForm = activeAction === "transfer" && isBloodline;
  const primaryLabel = canSend ? "출처 카드 보내기" : "다음 분에게 보내기";
  // 공유는 뿌리 혈통 공개 URL(출처 카드를 열었어도 미리보기는 뿌리 기준이다)
  const shareTarget = rootCard ?? card;
  const shareTitle = `${shareTarget.name} · ${shareTarget.speciesType ?? "혈통"}`;

  return (
    <Layout headerVariant="none" seoTitle={card.name}>
      <BloodlineHeader
        title={typeLabel}
        right={
          <BloodlineHeaderButton
            label="공유"
            onClick={() =>
              void shareOrCopy({
                title: shareTitle,
                url: `/bloodline-management/card/${shareTarget.id}`,
              })
            }
          >
            <ShareIcon />
          </BloodlineHeaderButton>
        }
      />

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
              {withJosa(celebrationName || "혈통", "을/를")} 만들었어요
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
            // 상세에서는 카드 번호를 보이지 않는다(설계 §4.4 ⑤ 발급번호 삭제)
            cardId={null}
            name={card.name}
            subtitle={bloodlineCardMeta(card)}
            ownerName={bloodlineUserLabel(card.currentOwner)}
            typeLabel={typeLabel}
            issuedAt={card.createdAt}
            image={card.image}
          />
        </div>

        <SectionGap />
        <SectionTitle label={`${typeLabel} 정보`} />
        <div>
          {infoRows.map((row, index) => (
            <InfoRow key={row.label} {...row} first={index === 0} />
          ))}
        </div>

        {myLineCard ? (
          <div className="flex items-center justify-between border-t border-app-line px-4 py-[13px]">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-[-0.2px] text-app-text">
                내 닉네임 공개
              </p>
              <p className="mt-[3px] text-[13px] tracking-[-0.2px] text-app-muted">
                켜면 이 혈통 페이지에 {withJosa(user?.name || "내 닉네임", "으로/로")} 보여요
              </p>
            </div>
            <NameVisibleSwitch
              checked={nameVisible}
              disabled={nameVisibleSaving}
              onChange={() => void toggleNameVisible(myLineCard, !nameVisible)}
            />
          </div>
        ) : null}

        <SectionGap />
        <SectionTitle label="이력" />
        {eventsLoading ? (
          <div className="flex justify-center py-8">
            <BloodlineSpinner />
          </div>
        ) : visibleEvents.length > 0 ? (
          <div>
            {visibleEvents.slice(0, 8).map((record, index) => (
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

        <p className="px-4 pt-5 text-[13px] leading-[19px] tracking-[-0.2px] text-app-muted">
          {BLOODLINE_TRUST_NOTICE}
        </p>

        {isBloodline && canTransfer && activeAction === null ? (
          <div className="px-4 pt-5">
            <BloodlineSecondaryButton onClick={() => openAction("transfer")}>
              혈통 넘기기
            </BloodlineSecondaryButton>
          </div>
        ) : null}

        {activeAction !== null ? (
          <div className="px-4 pt-5">
            <FieldLabel label="받는 분" htmlFor="bloodline-send-to" />
            <Input
              id="bloodline-send-to"
              value={toUserName}
              onChange={(event) => {
                recipientEditedRef.current = true;
                setToUserName(event.target.value);
                setToUserId(undefined);
                setSendSource({ type: "search" });
              }}
              placeholder="닉네임 검색"
              autoComplete="off"
              disabled={sending}
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
              <FieldLabel label="메모 (선택)" htmlFor="bloodline-send-note" />
              <Input
                id="bloodline-send-note"
                value={sendNote}
                maxLength={NOTE_MAX_LENGTH}
                onChange={(event) => setSendNote(event.target.value)}
                placeholder="예: 26 봄 세트 3령 암컷"
                disabled={sending}
                className={bloodlineInputClass}
              />
              {isRootTransferForm ? null : (
                <p className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-muted">
                  메모는 받는 분의 카드 화면에 함께 보여요
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div className="h-8" />
      </form>

      {showActionBar || activeAction !== null ? <BloodlineBottomBarSpacer /> : null}

      {showActionBar ? (
        <BloodlineBottomBar>
          <BloodlinePrimaryButton onClick={() => openAction(canSend ? "send" : "transfer")}>
            {primaryLabel}
          </BloodlinePrimaryButton>
        </BloodlineBottomBar>
      ) : null}

      {activeAction !== null ? (
        <BloodlineBottomBar>
          <BloodlineSecondaryButton onClick={cancelAction} disabled={sending}>
            취소
          </BloodlineSecondaryButton>
          <BloodlinePrimaryButton
            onClick={() => void submitSend()}
            disabled={sending || !toUserName.trim()}
          >
            {isRootTransferForm
              ? sending
                ? "넘기는 중..."
                : "넘기기"
              : sending
                ? "보내는 중..."
                : "보내기"}
          </BloodlinePrimaryButton>
        </BloodlineBottomBar>
      ) : null}
      {confirmDialog}
    </Layout>
  );
}
