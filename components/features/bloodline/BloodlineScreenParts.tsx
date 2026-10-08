"use client";

/**
 * 혈통관리 계열 화면 공용 조각 — 앱 bloodline-management/*, bloodline-cards/create 와 같은 모양.
 * 헤더(뒤로 40 + 제목 18/700 + 선택 검색·오른쪽 슬롯) / 하단 고정 바 / 주·보조 버튼 / 입력 클래스 / 로그인 이동.
 * 아래쪽은 혈통 화면들이 같이 쓰는 문구 함수다(용어: 혈통 / 출처 카드, 가린 사용자 "닉네임 비공개").
 * 문구는 앱 src/lib/bloodlineLabels.ts·채택 시안 A2 와 같다.
 */
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toLoginHref } from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";
import { DELETED_USER_LABEL, displayUserName } from "@libs/shared/deletedUser";
import { bloodlineErrorMessage, isBloodlineErrorCode } from "@libs/shared/bloodline-errors";
import { formatRegionShort } from "@libs/shared/regions";
import { isSameNickname } from "@libs/shared/nickname";
import {
  BLOODLINE_MASKED_USER_NAME,
  bloodlineUserPhrase,
  formatBloodlineEventDate,
  formatReceivedCount,
  type BloodlineCardEventItem,
  type BloodlineCardEventType,
  type BloodlineCardItem,
  type BloodlineUserRef,
} from "@libs/shared/bloodline-card";

/** 앱 전역 Input: h48 r8 border, 15px, 포커스 테두리 text, placeholder caption. */
export const bloodlineInputClass =
  "h-12 rounded-lg border-app-border bg-app-bg px-3.5 text-[15px] text-app-text placeholder:text-app-caption focus-visible:border-app-text focus-visible:ring-0 focus-visible:ring-offset-0";

export const bloodlineTextareaClass =
  "min-h-[120px] rounded-lg border-app-border bg-app-bg px-3.5 py-3 text-[15px] leading-[22px] text-app-text placeholder:text-app-caption focus-visible:border-app-text focus-visible:ring-0 focus-visible:ring-offset-0";

/** 네이티브 select(종·산지): 입력과 같은 h48 r8 border, 15px. */
export const bloodlineSelectClass =
  "h-12 w-full min-w-0 rounded-lg border border-app-border bg-app-bg px-3 text-[15px] text-app-text focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-60";

function BackIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={1.5} />
      <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 공유 아이콘(시안 A2 헤더, 1.5 라인). */
export function ShareIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8M5 12v7a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const headerIconClass =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full text-app-text transition-colors hover:bg-app-surface";

/** 헤더 오른쪽 아이콘 버튼(40). 공유처럼 화면이 동작을 정한다. */
export function BloodlineHeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={headerIconClass}>
      {children}
    </button>
  );
}

/** 헤더 h56: 뒤로(40) + 제목 18/700 + (선택) 검색(40) + (선택) 오른쪽 슬롯. 그림자·하단선 없음(시안). */
export function BloodlineHeader({
  title,
  searchHref,
  right,
}: {
  title: string;
  searchHref?: string;
  /** 오른쪽 끝 슬롯(상세 공유 아이콘 등) */
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center bg-app-bg pl-1 pr-2">
      <button type="button" aria-label="뒤로" onClick={() => router.back()} className={headerIconClass}>
        <BackIcon />
      </button>
      <h1 className="ml-1 min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.3px] text-app-text">
        {title}
      </h1>
      {searchHref ? (
        <Link href={searchHref} aria-label="검색" className={headerIconClass}>
          <SearchIcon />
        </Link>
      ) : null}
      {right}
    </header>
  );
}

/** 하단 고정 바: 상단 1px line, pt10 px16 pb12+safe-area. */
export function BloodlineBottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto flex max-w-xl gap-2 border-t border-app-line bg-app-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5">
        {children}
      </div>
    </div>
  );
}

/** 하단 고정 바 높이만큼 본문 끝에 둔다. */
export function BloodlineBottomBarSpacer() {
  return <div aria-hidden="true" className="h-[calc(76px+env(safe-area-inset-bottom))]" />;
}

const buttonBase =
  "inline-flex h-[52px] flex-1 items-center justify-center rounded-md text-[16px] font-semibold tracking-[-0.3px] transition-opacity disabled:opacity-60";

export function BloodlinePrimaryButton({
  children,
  onClick,
  href,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const classes = cn(buttonBase, "w-full bg-app-brand text-white", className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function BloodlineSecondaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(buttonBase, "w-full bg-app-surface text-app-text", className)}
    >
      {children}
    </button>
  );
}

/** 회색 원형 스피너(앱 ActivityIndicator muted). */
export function BloodlineSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="불러오는 중"
      className={cn(
        "inline-block h-6 w-6 animate-spin rounded-full border-2 border-app-line border-t-app-muted",
        className
      )}
    />
  );
}

/**
 * 비로그인 확정 시 로그인 화면으로 보낸다(앱 LoginRedirect). 확인 중·이동 중에는 호출부가 스피너를 그린다.
 */
export function useBloodlineLoginRedirect(
  shouldRedirect: boolean,
  next: string
) {
  const router = useRouter();
  useEffect(() => {
    if (shouldRedirect) router.replace(toLoginHref(next));
  }, [shouldRedirect, next, router]);
}

/* ------------------------------------------------------------------ */
/* 혈통 화면 문구 (앱 src/lib/bloodlineLabels.ts 와 같은 규칙)             */
/* ------------------------------------------------------------------ */

/** 상세·목록 아래 신뢰 고지(시안 A2, 앱 상세와 같은 문구). */
export const BLOODLINE_TRUST_NOTICE =
  "보낸 기록(누가 누구에게 언제)은 브리디가 남겨요. 소개·크기는 브리더가 입력한 것이고, 브리디가 보증하지는 않아요.";

/** 행·표의 이름 자리: 가렸으면 "닉네임 비공개", 없거나 탈퇴면 "탈퇴한 사용자". */
export function bloodlineUserLabel(user?: BloodlineUserRef | null): string {
  if (user?.masked) return BLOODLINE_MASKED_USER_NAME;
  return displayUserName(user?.name).trim() || DELETED_USER_LABEL;
}

/** 프로필 링크. 가린 사용자·id 0(탈퇴·비공개)은 링크를 걸지 않는다. */
export function bloodlineProfileHref(user?: BloodlineUserRef | null): string | null {
  if (!user || user.masked || !user.id) return null;
  return `/profiles/${user.id}`;
}

/** 숫자를 읽었을 때 받침 유무(0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔). */
const DIGIT_HAS_BATCHIM: Readonly<Record<string, boolean>> = {
  "0": true,
  "1": true,
  "2": false,
  "3": true,
  "4": false,
  "5": false,
  "6": true,
  "7": true,
  "8": true,
  "9": false,
};

/** 마지막 글자 받침: "none" | "rieul"(ㄹ) | "other". 한글이 아니면 숫자·영문으로 어림한다. */
function finalConsonant(word: string): "none" | "rieul" | "other" {
  const last = word.trim().slice(-1);
  if (!last) return "none";
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return "none";
    return jong === 8 ? "rieul" : "other";
  }
  if (last in DIGIT_HAS_BATCHIM) {
    if (!DIGIT_HAS_BATCHIM[last]) return "none";
    return last === "1" || last === "7" || last === "8" ? "rieul" : "other";
  }
  const lower = last.toLowerCase();
  if (lower === "l") return "rieul";
  if (lower === "m" || lower === "n") return "other";
  return "none";
}

export type JosaPair = "을/를" | "이/가" | "은/는" | "과/와" | "으로/로";

/** 단어 + 알맞은 조사. withJosa("강산 라인", "을/를") → "강산 라인을", withJosa("도윤파파", "으로/로") → "도윤파파로". */
export function withJosa(word: string, pair: JosaPair): string {
  const fc = finalConsonant(word);
  const [withBatchim, withoutBatchim] = pair.split("/");
  if (pair === "으로/로") return `${word}${fc === "other" ? "으로" : "로"}`;
  return `${word}${fc === "none" ? withoutBatchim : withBatchim}`;
}

/** 상세 하단 동작: send = 출처 카드 보내기(issue-line), transfer = 카드 자체 넘기기(혈통 넘기기 / 다음 분에게 보내기). */
export type BloodlineSendAction = "send" | "transfer";

export interface BloodlineSendParams {
  action: BloodlineSendAction | null;
  toUserId?: number;
  toUserName?: string;
  auctionId?: number;
}

const readPositiveInt = (value: string | null) => {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * 상세 진입 쿼리. `?action=send&toUserId&toUserName&auctionId`(경매 낙찰자 제안 링크)와
 * 예전 값 `?action=issue`(= send)·`?action=transfer` 를 읽는다. 잘못된 숫자는 버린다.
 */
export function readBloodlineSendParams(
  params: { get(name: string): string | null } | null | undefined
): BloodlineSendParams {
  const raw = params?.get("action");
  const action: BloodlineSendAction | null =
    raw === "send" || raw === "issue" ? "send" : raw === "transfer" ? "transfer" : null;
  const result: BloodlineSendParams = { action };
  const toUserId = readPositiveInt(params?.get("toUserId") ?? null);
  const toUserName = params?.get("toUserName")?.trim();
  const auctionId = readPositiveInt(params?.get("auctionId") ?? null);
  if (toUserId) result.toUserId = toUserId;
  if (toUserName) result.toUserName = toUserName;
  if (auctionId) result.auctionId = auctionId;
  return result;
}

/**
 * 링크(`?toUserId&toUserName`, 경매 낙찰자 제안 등)로 미리 채울 받는 사람. URL 은 누구나 만들 수 있으므로
 * URL 닉네임을 화면에 쓰지 않고 toUserId 의 실제 프로필(GET /api/users/{id}) 닉네임을 쓴다.
 * URL 닉네임이 그 프로필과 다르면(다른 사람 id 를 다른 닉네임으로 위장) 채우지 않는다(앱 resolveSendPreset 과 같다).
 */
export function resolveBloodlineSendPreset(
  params: Pick<BloodlineSendParams, "toUserId" | "toUserName">,
  profile: { success?: boolean; user?: { id?: number; name?: string | null } | null } | null | undefined
): { id: number; name: string } | null {
  const user = profile?.success ? profile.user : null;
  if (!params.toUserId || !user || user.id !== params.toUserId) return null;
  const name = user.name?.trim();
  if (!name) return null;
  if (params.toUserName && !isSameNickname(params.toUserName, name)) return null;
  return { id: params.toUserId, name };
}

/** 혈통 API 오류 문구: 아는 errorCode 면 표의 문구, 아니면 서버 error, 그것도 없으면 fallback. */
export function bloodlineErrorText(
  payload: { errorCode?: string | null; error?: string | null } | null | undefined,
  fallback: string
): string {
  if (isBloodlineErrorCode(payload?.errorCode)) {
    return bloodlineErrorMessage(payload?.errorCode, payload?.error);
  }
  const server = payload?.error?.trim();
  return server || fallback;
}

/** 산지 짧은 표시("충남 공주"): 서버 originLabel → originSido/originSigungu. 없으면 null. */
export function bloodlineOriginText(
  card: Pick<BloodlineCardItem, "originLabel" | "originSido" | "originSigungu">
): string | null {
  const label = card.originLabel?.trim();
  if (label) return label;
  return formatRegionShort({ sido: card.originSido, sigungu: card.originSigungu });
}

/**
 * 출처 카드를 지금 보유자가 어떻게 받았는지(앱 sourceCardReceipt).
 * 다음 분에게 보내기로 받았으면 마지막 넘김 기록, 아니면 발급(보낸 사람 = 카드 creator, 메모 = description).
 */
export function bloodlineSourceReceipt(
  line: Pick<BloodlineCardItem, "creator" | "currentOwner" | "createdAt" | "description" | "transfers">
): { from: BloodlineUserRef | null; receivedAt: string; note: string | null } {
  const time = (value: string) => {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const handoff = [...(line.transfers ?? [])]
    .sort((a, b) => time(b.createdAt) - time(a.createdAt))
    .find((transfer) => transfer.fromUser && transfer.toUser && transfer.toUser.id === line.currentOwner.id);
  if (handoff) {
    return { from: handoff.fromUser, receivedAt: handoff.createdAt, note: handoff.note?.trim() || null };
  }
  return { from: line.creator, receivedAt: line.createdAt, note: line.description?.trim() || null };
}

/**
 * 목록 행 메타.
 * - 혈통: "사슴벌레 · 충남 공주 · 받은 사람 3명" / "… · 아직 받은 사람 없음"(구 서버라 수가 없으면 뺀다)
 * - 출처 카드: "사슴벌레 · 강산님에게서 · 2026.09.12"
 * 종이 없으면 "종 미지정".
 */
export function bloodlineRowMeta(card: BloodlineCardItem): string {
  const species = card.speciesType?.trim() || "종 미지정";
  if (card.cardType === "LINE") {
    const receipt = bloodlineSourceReceipt(card);
    return [species, `${bloodlineUserPhrase(receipt.from)}에게서`, formatBloodlineEventDate(receipt.receivedAt)]
      .filter(Boolean)
      .join(" · ");
  }
  return [species, bloodlineOriginText(card), formatReceivedCount(card.receivedCount)]
    .filter(Boolean)
    .join(" · ");
}

/** 이력 짧은 라벨(앱 설계 §5.9). LINE_CREATED 는 화면에서 숨기는 중복 기록이다. */
export const BLOODLINE_EVENT_LABELS: Record<BloodlineCardEventType, string> = {
  BLOODLINE_CREATED: "만들었어요",
  LINE_CREATED: "보냈어요",
  LINE_ISSUED: "보냈어요",
  LINE_TRANSFER: "다음 분에게 보냈어요",
  BLOODLINE_TRANSFER: "혈통을 넘겼어요",
  CARD_REVOKED: "운영 정책으로 회수됐어요",
};

/** 이력 검색 문자열(소문자): 라벨 + 공개된 닉네임 + 혈통 이름 + 메모. 가린 사용자는 뺀다. */
export function bloodlineEventSearchText(
  event: Pick<BloodlineCardEventItem, "action" | "actorUser" | "fromUser" | "toUser" | "relatedCard" | "note">
): string {
  const names = [event.actorUser, event.fromUser, event.toUser]
    .filter((user): user is BloodlineUserRef => Boolean(user && !user.masked))
    .map((user) => displayUserName(user.name));
  return [BLOODLINE_EVENT_LABELS[event.action] ?? "", ...names, event.relatedCard?.name ?? "", event.note ?? ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
