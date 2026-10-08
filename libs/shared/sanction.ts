import type { ModerationTargetType, ReportTargetType, SanctionType } from "@prisma/client";
import { REPORT_TARGET_LABEL } from "@libs/shared/report";

/**
 * 사용자 제재(경고·기간 정지·영구 정지·해제)와 운영 알림 공용 상수.
 * 서버 API·관리자 페이지가 함께 쓰고, 앱(bredy_app src/lib/moderation/sanction.ts)은 같은 값을 복사해 쓴다.
 * 기획: 앱 docs/prd/admin-moderation.md
 */

export type { SanctionType };

export const SANCTION_TYPES = [
  "WARNING",
  "SUSPENSION",
  "BAN",
  "LIFT",
] as const satisfies readonly SanctionType[];

export const isSanctionType = (value: unknown): value is SanctionType =>
  typeof value === "string" && (SANCTION_TYPES as readonly string[]).includes(value);

/** 기간 정지 일수. 운영자는 이 중에서만 고른다(2026-10-09 결정). */
export const SUSPENSION_DAY_OPTIONS = [1, 3, 7, 10, 30] as const;
export type SuspensionDays = (typeof SUSPENSION_DAY_OPTIONS)[number];

export const isSuspensionDays = (value: unknown): value is SuspensionDays =>
  typeof value === "number" && (SUSPENSION_DAY_OPTIONS as readonly number[]).includes(value);

export const SANCTION_MESSAGE_MAX = 300;
export const SANCTION_INTERNAL_NOTE_MAX = 500;
/** 사유가 '기타'면 대상자에게 보낼 메시지를 이 길이 이상 적어야 한다. */
export const SANCTION_MESSAGE_MIN_FOR_OTHER = 5;
/** 누적 제재·권장 조치를 셀 때 보는 기간 */
export const SANCTION_COUNT_WINDOW_DAYS = 180;

export const SANCTION_REASON_CODES = [
  "SPAM",
  "ABUSE",
  "SEXUAL",
  "PRIVACY",
  "FALSE_INFO",
  "FRAUD",
  "ILLEGAL_ITEM",
  "DUPLICATE",
  "HARASSMENT",
  "IMPERSONATION",
  "TRADE_ABUSE",
  "OTHER",
] as const;
export type SanctionReasonCode = (typeof SANCTION_REASON_CODES)[number];

export const isSanctionReasonCode = (value: unknown): value is SanctionReasonCode =>
  typeof value === "string" && (SANCTION_REASON_CODES as readonly string[]).includes(value);

export const SANCTION_REASON_LABEL: Record<SanctionReasonCode, string> = {
  SPAM: "스팸·광고",
  ABUSE: "욕설·비하·혐오 표현",
  SEXUAL: "음란·선정적 내용",
  PRIVACY: "개인정보 노출",
  FALSE_INFO: "허위 정보",
  FRAUD: "사기·허위 매물",
  ILLEGAL_ITEM: "거래 금지 품목(불법 개체)",
  DUPLICATE: "중복·도배",
  HARASSMENT: "괴롭힘·협박",
  IMPERSONATION: "사칭",
  TRADE_ABUSE: "거래 방해·비정상 거래",
  OTHER: "기타",
};

/** 저장된 사유 코드의 화면 문구. 모르는 코드(옛 데이터)는 '기타'로 보인다. */
export const sanctionReasonLabel = (code: string | null | undefined) =>
  isSanctionReasonCode(code) ? SANCTION_REASON_LABEL[code] : SANCTION_REASON_LABEL.OTHER;

/**
 * 신고 사유(libs/shared/report.ts REPORT_REASONS, 경매 신고 사유) → 제재 사유 기본값.
 * 신고 처리 패널이 처음 고를 값이다. 운영자가 바꿀 수 있다.
 */
export const REPORT_REASON_TO_SANCTION_REASON: Record<string, SanctionReasonCode> = {
  "스팸·광고": "SPAM",
  "욕설·비하·혐오 표현": "ABUSE",
  "음란·선정적 내용": "SEXUAL",
  "개인정보 노출": "PRIVACY",
  "허위 정보": "FALSE_INFO",
  "허위 매물·사기 의심": "FRAUD",
  "거래 금지 품목(불법 개체)": "ILLEGAL_ITEM",
  "중복·도배 게시": "DUPLICATE",
  "욕설·부적절 내용": "ABUSE",
  "욕설·협박": "HARASSMENT",
  "사기 의심": "FRAUD",
  "음란 메시지": "SEXUAL",
  사칭: "IMPERSONATION",
  "사기 이력 의심": "FRAUD",
  "반복적 욕설·괴롭힘": "HARASSMENT",
  "스팸 계정": "SPAM",
  "남의 혈통 이름 도용": "IMPERSONATION",
  "허위 매물 의심": "FRAUD",
  "입찰 방해/분쟁 유도": "TRADE_ABUSE",
  "비정상 가격 유도": "TRADE_ABUSE",
  "욕설/부적절 내용": "ABUSE",
  기타: "OTHER",
};

export const defaultSanctionReason = (reportReason: string | null | undefined): SanctionReasonCode =>
  (reportReason && REPORT_REASON_TO_SANCTION_REASON[reportReason]) || "OTHER";

// ------------------------------------------------------------
// 권장 조치 — 최근 180일 경고·정지 수에 따라 다음 단계를 권한다(자동 적용하지 않는다).
// ------------------------------------------------------------

export type SanctionRecommendation =
  | { type: "WARNING" }
  | { type: "SUSPENSION"; days: SuspensionDays }
  | { type: "BAN" };

const RECOMMENDED_LADDER: readonly SanctionRecommendation[] = [
  { type: "WARNING" },
  { type: "SUSPENSION", days: 3 },
  { type: "SUSPENSION", days: 10 },
  { type: "SUSPENSION", days: 30 },
  { type: "BAN" },
];

/** @param priorCount 최근 180일 동안 받은 경고·기간 정지 수 */
export function recommendSanction(priorCount: number): SanctionRecommendation {
  const index = Math.min(Math.max(0, Math.floor(priorCount)), RECOMMENDED_LADDER.length - 1);
  return RECOMMENDED_LADDER[index];
}

export function sanctionActionLabel(action: SanctionRecommendation | { type: SanctionType; days?: number | null }) {
  switch (action.type) {
    case "WARNING":
      return "경고";
    case "SUSPENSION":
      return action.days ? `${action.days}일 정지` : "기간 정지";
    case "BAN":
      return "영구 정지";
    case "LIFT":
      return "정지 해제";
  }
}

// ------------------------------------------------------------
// 기간 계산·날짜 문구
// ------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 기간 정지 만료 시각. 이미 정지 중이면 남은 기간에 더한다(2026-10-09 결정).
 * @param currentUntil 지금 정지 만료 시각. 정지 중이 아니거나 이미 지났으면 무시한다.
 */
export function extendSuspensionUntil(now: Date, currentUntil: Date | null | undefined, days: number): Date {
  const base = currentUntil && currentUntil.getTime() > now.getTime() ? currentUntil : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/** KST 기준 'YYYY.MM.DD' */
export function formatKstDate(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, ".");
}

/** KST 기준 'YYYY.MM.DD HH:mm' */
export function formatKstDateTime(date: Date): string {
  const iso = new Date(date.getTime() + KST_OFFSET_MS).toISOString();
  return `${iso.slice(0, 10).replace(/-/g, ".")} ${iso.slice(11, 16)}`;
}

// ------------------------------------------------------------
// 입력 검증 — 관리자 API 와 관리자 화면이 같은 규칙을 쓴다.
// ------------------------------------------------------------

export interface SanctionDraft {
  type: SanctionType;
  days?: number | null;
  reasonCode?: string | null;
  messageToUser?: string | null;
  internalNote?: string | null;
}

/** 문제가 없으면 null, 있으면 화면에 보일 문구 */
export function validateSanctionDraft(draft: SanctionDraft): string | null {
  if (!isSanctionType(draft.type)) return "제재 유형이 올바르지 않아요.";
  if (draft.type === "SUSPENSION" && !isSuspensionDays(draft.days)) {
    return `정지 기간은 ${SUSPENSION_DAY_OPTIONS.join("·")}일 중에서 골라 주세요.`;
  }
  if (draft.type !== "SUSPENSION" && draft.days != null) return "정지 기간은 기간 정지에만 쓸 수 있어요.";
  if (!isSanctionReasonCode(draft.reasonCode)) return "사유를 골라 주세요.";
  const message = draft.messageToUser?.trim() ?? "";
  if (message.length > SANCTION_MESSAGE_MAX) return `사용자에게 보낼 메시지는 ${SANCTION_MESSAGE_MAX}자까지 쓸 수 있어요.`;
  if (draft.reasonCode === "OTHER" && draft.type !== "LIFT" && message.length < SANCTION_MESSAGE_MIN_FOR_OTHER) {
    return `사유가 '기타'면 사용자에게 보낼 메시지를 ${SANCTION_MESSAGE_MIN_FOR_OTHER}자 이상 적어 주세요.`;
  }
  if ((draft.internalNote?.trim().length ?? 0) > SANCTION_INTERNAL_NOTE_MAX) {
    return `내부 메모는 ${SANCTION_INTERNAL_NOTE_MAX}자까지 쓸 수 있어요.`;
  }
  return null;
}

// ------------------------------------------------------------
// 운영 알림 문구(NotificationType.MODERATION). 대상자에게는 사유 범주만 보이고 신고자 정보는 넣지 않는다.
// ------------------------------------------------------------

export const MODERATION_TARGET_LABEL: Record<ModerationTargetType, string> = {
  POST: "게시글",
  COMMENT: "댓글",
  PRODUCT: "상품",
  AUCTION: "경매",
  BLOODLINE_CARD: "혈통",
};

const TITLE_PREVIEW_MAX = 20;

/** 알림에 넣을 제목 앞부분(20자, 넘치면 …) */
export function previewTitle(title: string | null | undefined): string {
  const text = (title ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= TITLE_PREVIEW_MAX) return text;
  return `${text.slice(0, TITLE_PREVIEW_MAX)}…`;
}

/** 마지막 글자 받침에 맞춘 '이/가'. 한글이 아니면 '이(가)' */
function subjectParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return "이(가)";
  return (last - 0xac00) % 28 === 0 ? "가" : "이";
}

const withReason = (reasonCode: string | null | undefined) =>
  reasonCode ? ` 사유: ${sanctionReasonLabel(reasonCode)}` : "";

export function warningNoticeMessage(reasonCode: string | null | undefined) {
  return `운영정책 위반으로 경고를 받았어요.${withReason(reasonCode)}`;
}

export function suspensionNoticeMessage(params: {
  days: number;
  until: Date;
  extended: boolean;
  reasonCode: string | null | undefined;
}) {
  if (params.extended) {
    return `운영정책 위반으로 이용 정지가 ${params.days}일 늘어났어요. ${formatKstDate(params.until)} 이후 다시 이용할 수 있어요.${withReason(params.reasonCode)}`;
  }
  return `운영정책 위반으로 ${params.days}일 동안 이용이 정지되었어요.${withReason(params.reasonCode)}`;
}

export function banNoticeMessage(reasonCode: string | null | undefined) {
  return `운영정책 위반으로 이용이 영구 정지되었어요.${withReason(reasonCode)}`;
}

export const LIFT_NOTICE_MESSAGE = "이용 정지가 해제되었어요.";

const quoted = (title: string | null | undefined) => {
  const preview = previewTitle(title);
  return preview ? `'${preview}'` : "";
};

const reasonInParens = (reasonCode: string | null | undefined) =>
  reasonCode ? `(${sanctionReasonLabel(reasonCode)})` : "";

export function contentHiddenMessage(
  targetType: ModerationTargetType,
  title: string | null | undefined,
  reasonCode: string | null | undefined
) {
  const label = MODERATION_TARGET_LABEL[targetType];
  const name = quoted(title);
  const subject = name ? `${label} ${name}${subjectParticle(previewTitle(title))}` : `${label}${subjectParticle(label)}`;
  return `작성하신 ${subject} 운영정책 위반${reasonInParens(reasonCode)}으로 숨김 처리되었어요. 나에게만 보여요.`;
}

export function contentUnhiddenMessage(targetType: ModerationTargetType, title: string | null | undefined) {
  const name = quoted(title);
  return name
    ? `${name} 숨김이 해제되어 다시 공개되었어요.`
    : `작성하신 ${MODERATION_TARGET_LABEL[targetType]}의 숨김이 해제되어 다시 공개되었어요.`;
}

export function contentDeletedMessage(
  targetType: ModerationTargetType,
  title: string | null | undefined,
  reasonCode: string | null | undefined
) {
  const label = MODERATION_TARGET_LABEL[targetType];
  const name = quoted(title);
  const subject = name ? `${label} ${name}${subjectParticle(previewTitle(title))}` : `${label}${subjectParticle(label)}`;
  return `작성하신 ${subject} 운영정책 위반${reasonInParens(reasonCode)}으로 삭제되었어요.`;
}

/** 신고자 알림. 조치가 하나 이상 적용됐을 때만 보낸다(기각·조치 없음은 보내지 않는다). */
export function reporterActionMessage(targetType: ReportTargetType | "AUCTION") {
  const label = targetType === "AUCTION" ? "경매" : REPORT_TARGET_LABEL[targetType];
  return `신고하신 ${label}에 대해 운영정책에 따라 조치했어요.`;
}

/** 운영 알림의 targetType. 경고·정지 알림은 내 제재 내역으로 연결한다. */
export const SANCTION_NOTIFICATION_TARGET = "sanction";
