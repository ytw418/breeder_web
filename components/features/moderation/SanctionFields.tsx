"use client";

import {
  LIFT_NOTICE_MESSAGE,
  SANCTION_INTERNAL_NOTE_MAX,
  SANCTION_MESSAGE_MAX,
  SANCTION_REASON_CODES,
  SANCTION_REASON_LABEL,
  SUSPENSION_DAY_OPTIONS,
  banNoticeMessage,
  sanctionActionLabel,
  suspensionNoticeMessage,
  validateSanctionDraft,
  warningNoticeMessage,
  type SanctionReasonCode,
  type SanctionRecommendation,
  type SuspensionDays,
} from "@libs/shared/sanction";

/**
 * 관리자 사용자 조치 입력(신고 처리 패널·유저 상세·경매 신고 패널 공용).
 * 유형(없음·경고·기간 정지·영구 정지·해제) → 기간 → 사유 → 사용자에게 보낼 메시지 → 내부 메모 순서이고,
 * 대상자가 받을 알림 문구를 아래에 미리 보여 준다. 기획: 앱 docs/prd/admin-moderation.md S-1·S-3·S-9
 */

export type SanctionFieldType = "NONE" | "WARNING" | "SUSPENSION" | "BAN" | "LIFT";

export interface SanctionFieldsValue {
  type: SanctionFieldType;
  days: SuspensionDays;
  reasonCode: SanctionReasonCode;
  messageToUser: string;
  internalNote: string;
}

export const initialSanctionFields = (
  reasonCode: SanctionReasonCode = "OTHER",
  type: SanctionFieldType = "NONE"
): SanctionFieldsValue => ({
  type,
  days: 3,
  reasonCode,
  messageToUser: "",
  internalNote: "",
});

/** 추천 조치를 입력값으로 옮긴다(운영자가 '권장대로' 를 눌렀을 때) */
export const applyRecommendation = (
  value: SanctionFieldsValue,
  recommendation: SanctionRecommendation
): SanctionFieldsValue => ({
  ...value,
  type: recommendation.type,
  days: recommendation.type === "SUSPENSION" ? recommendation.days : value.days,
});

/** 문제가 없으면 null. 조치 없음은 언제나 통과 */
export function validateSanctionFields(value: SanctionFieldsValue): string | null {
  if (value.type === "NONE") return null;
  return validateSanctionDraft({
    type: value.type,
    days: value.type === "SUSPENSION" ? value.days : null,
    reasonCode: value.reasonCode,
    messageToUser: value.messageToUser,
    internalNote: value.internalNote,
  });
}

/** API body 의 제재 부분. 조치 없음이면 null */
export function toSanctionPayload(value: SanctionFieldsValue) {
  if (value.type === "NONE") return null;
  return {
    type: value.type,
    days: value.type === "SUSPENSION" ? value.days : null,
    reasonCode: value.reasonCode,
    messageToUser: value.messageToUser.trim() || null,
    internalNote: value.internalNote.trim() || null,
  };
}

export function sanctionPreview(value: SanctionFieldsValue): string | null {
  switch (value.type) {
    case "NONE":
      return null;
    case "WARNING":
      return warningNoticeMessage(value.reasonCode);
    case "SUSPENSION":
      return suspensionNoticeMessage({
        days: value.days,
        until: new Date(Date.now() + value.days * 24 * 60 * 60 * 1000),
        extended: false,
        reasonCode: value.reasonCode,
      });
    case "BAN":
      return banNoticeMessage(value.reasonCode);
    case "LIFT":
      return LIFT_NOTICE_MESSAGE;
  }
}

const TYPE_LABEL: Record<SanctionFieldType, string> = {
  NONE: "없음",
  WARNING: "경고",
  SUSPENSION: "기간 정지",
  BAN: "영구 정지",
  LIFT: "정지 해제",
};

interface SanctionFieldsProps {
  value: SanctionFieldsValue;
  onChange: (next: SanctionFieldsValue) => void;
  /** 고를 수 있는 유형(기본: 없음·경고·기간 정지·영구 정지) */
  types?: SanctionFieldType[];
  /** "최근 180일 경고 1 · 정지 0 · 받은 신고 4" 같은 요약 줄 */
  summary?: string | null;
  recommendation?: SanctionRecommendation | null;
  /** 내부 메모 입력을 감출지(신고 처리 패널은 신고 메모와 같이 쓴다) */
  hideInternalNote?: boolean;
  disabled?: boolean;
  /** 같은 화면에 여러 개 있을 때 라디오 name 구분 */
  name: string;
}

export default function SanctionFields({
  value,
  onChange,
  types = ["NONE", "WARNING", "SUSPENSION", "BAN"],
  summary,
  recommendation,
  hideInternalNote = false,
  disabled = false,
  name,
}: SanctionFieldsProps) {
  const set = (patch: Partial<SanctionFieldsValue>) => onChange({ ...value, ...patch });
  const preview = sanctionPreview(value);
  const error = validateSanctionFields(value);
  const needsReason = value.type !== "NONE";

  return (
    <div className="space-y-2 text-sm">
      {summary || recommendation ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          {summary ? <span>{summary}</span> : null}
          {recommendation ? (
            <>
              <span className="font-semibold text-slate-800">권장: {sanctionActionLabel(recommendation)}</span>
              <button
                type="button"
                disabled={disabled}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => onChange(applyRecommendation(value, recommendation))}
              >
                권장대로
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <fieldset disabled={disabled} className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <legend className="mb-1 text-xs font-semibold text-slate-700">사용자 조치</legend>
        {types.map((type) => (
          <label key={type} className="inline-flex items-center gap-1 text-sm">
            <input
              type="radio"
              name={`${name}-type`}
              checked={value.type === type}
              onChange={() => set({ type })}
            />
            <span className={type === "BAN" ? "font-semibold text-rose-700" : ""}>{TYPE_LABEL[type]}</span>
          </label>
        ))}
        {value.type === "SUSPENSION" ? (
          <select
            aria-label="정지 기간"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={value.days}
            onChange={(event) => set({ days: Number(event.target.value) as SuspensionDays })}
          >
            {SUSPENSION_DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days}일
              </option>
            ))}
          </select>
        ) : null}
      </fieldset>

      {needsReason ? (
        <>
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs font-semibold text-slate-700">사유</span>
            <select
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              value={value.reasonCode}
              disabled={disabled}
              onChange={(event) => set({ reasonCode: event.target.value as SanctionReasonCode })}
            >
              {SANCTION_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {SANCTION_REASON_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">
              사용자에게 보낼 메시지{value.reasonCode === "OTHER" && value.type !== "LIFT" ? " (필수, 5자 이상)" : " (선택)"}
            </span>
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              rows={2}
              maxLength={SANCTION_MESSAGE_MAX}
              disabled={disabled}
              value={value.messageToUser}
              placeholder="예: 댓글에서 다른 회원을 비하하는 표현이 확인되었어요."
              onChange={(event) => set({ messageToUser: event.target.value })}
            />
          </label>
          {hideInternalNote ? null : (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">내부 메모 (운영자만 봄)</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                rows={2}
                maxLength={SANCTION_INTERNAL_NOTE_MAX}
                disabled={disabled}
                value={value.internalNote}
                onChange={(event) => set({ internalNote: event.target.value })}
              />
            </label>
          )}
        </>
      ) : null}

      {preview ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600">
          대상자 알림 미리보기: {preview}
          {value.messageToUser.trim() ? ` / 메시지: ${value.messageToUser.trim()}` : ""}
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
