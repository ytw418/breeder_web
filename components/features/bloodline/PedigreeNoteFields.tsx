"use client";

/**
 * 상품·경매에 붙이는 혈통 메모 3칸(시안 A2 #S5-attach, PRD S-7): 부 mm · 모 mm · 누대 드롭다운.
 * - 값 규칙과 표시는 libs/shared/pedigree-note.ts 한 곳을 따른다(서버 검증과 같은 규칙).
 * - 부·모 칸은 입력 중인 문자열("81.")을 칸 안에 들고, 바깥에는 숫자로 넘긴다. 규칙에 안 맞는 값(81.25·0·501)도
 *   그대로 넘기므로 부모는 `readPedigreeNoteInput` 으로 저장할 값과 통과 여부를 정한다.
 * - 틀린 칸은 테두리를 danger 로 바꾸고 도움말 자리에 오류 문구를 보인다.
 */
import { useId, useState } from "react";
import {
  PEDIGREE_GENERATIONS,
  PEDIGREE_GENERATION_HELP,
  PEDIGREE_MM_MAX,
  PEDIGREE_MM_MIN,
  isPedigreeGeneration,
  isValidPedigreeMm,
  parsePedigreeNote,
  pedigreeGenerationLabel,
  type PedigreeNote,
} from "@libs/shared/pedigree-note";
import { cn } from "@libs/client/utils";

/** 부·모 칸 오류 문구(PRD S-7.오류). */
export const PEDIGREE_MM_ERROR_MESSAGE = `${PEDIGREE_MM_MIN}~${PEDIGREE_MM_MAX}mm, 소수 첫째 자리까지 적어 주세요`;

/** 칸 위 라벨 기본값(시안). */
export const PEDIGREE_NOTE_FIELDS_LABEL = "부모·누대 (선택)";

type MmKey = "sireMm" | "damMm";

/**
 * 칸 값 → 저장할 메모. 비면 null, 규칙에 안 맞으면 "invalid".
 * 등록·수정 payload 의 `pedigreeNote` 와 버튼 비활성 판단에 쓴다.
 */
export function readPedigreeNoteInput(note?: PedigreeNote | null): PedigreeNote | null | "invalid" {
  const parsed = parsePedigreeNote(note ?? null);
  return parsed.ok ? parsed.value : "invalid";
}

/** 칸 값이 규칙에 맞는지(비어 있어도 통과). */
export const isPedigreeNoteInputValid = (note?: PedigreeNote | null) =>
  readPedigreeNoteInput(note) !== "invalid";

/** 부·모 칸에 이미 값이 있는데 규칙에 안 맞는지. */
const isMmInvalid = (value?: number) => value !== undefined && !isValidPedigreeMm(value);

const mmToText = (value?: number) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

/** "81." → 81, "." → NaN, "" → undefined */
const textToMm = (text: string): number | undefined => {
  const trimmed = text.trim();
  return trimmed ? Number(trimmed) : undefined;
};

const sameMm = (a?: number, b?: number) =>
  a === b || (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b));

/** 숫자와 소수점 하나만 남긴다. 쉼표 소수점("81,2")은 점으로 바꾼다. */
export function sanitizePedigreeMmInput(raw: string) {
  const cleaned = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
}

/** 빈 값을 뺀 메모 객체(JSON 에 undefined 키를 남기지 않는다). */
function compactNote(note: PedigreeNote): PedigreeNote {
  const next: PedigreeNote = {};
  if (note.sireMm !== undefined) next.sireMm = note.sireMm;
  if (note.damMm !== undefined) next.damMm = note.damMm;
  if (note.generation !== undefined) next.generation = note.generation;
  return next;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 시안 .field44: 높이 44, 1px border, radius 6, 좌우 12, 글자 15, 간격 6. */
const fieldBoxClass =
  "relative flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-app-bg px-3 text-[15px] transition-colors";

/** @tailwindcss/forms 기본 테두리·패딩·화살표 배경을 지운다(칸 테두리는 감싼 label 이 그린다). */
const bareControlClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-app-text shadow-none outline-none placeholder:text-app-caption focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed";

export interface PedigreeNoteFieldsProps {
  value: PedigreeNote;
  onChange: (next: PedigreeNote) => void;
  /** 혈통을 고르기 전에는 3칸을 막는다(PRD S-7.빈). */
  disabled?: boolean;
  /** 칸 위 라벨. null 이면 그리지 않는다. */
  label?: string | null;
  className?: string;
}

export function PedigreeNoteFields({
  value,
  onChange,
  disabled = false,
  label = PEDIGREE_NOTE_FIELDS_LABEL,
  className,
}: PedigreeNoteFieldsProps) {
  const baseId = useId();
  const helpId = `${baseId}-help`;
  // 입력 중인 문자열("81.")을 칸에 그대로 보이게 들고 있는다. 바깥 값이 다른 숫자로 바뀌면(초기값 로드·초기화)
  // 렌더 시 바깥 값을 따른다.
  const [texts, setTexts] = useState<Record<MmKey, string>>(() => ({
    sireMm: mmToText(value.sireMm),
    damMm: mmToText(value.damMm),
  }));

  const textOf = (key: MmKey) =>
    sameMm(textToMm(texts[key]), value[key]) ? texts[key] : mmToText(value[key]);

  const sireInvalid = isMmInvalid(value.sireMm);
  const damInvalid = isMmInvalid(value.damMm);
  const hasError = !disabled && (sireInvalid || damInvalid);

  const changeMm = (key: MmKey, raw: string) => {
    const text = sanitizePedigreeMmInput(raw);
    setTexts((prev) => ({ ...prev, [key]: text }));
    onChange(compactNote({ ...value, [key]: textToMm(text) }));
  };

  const changeGeneration = (raw: string) => {
    onChange(compactNote({ ...value, generation: isPedigreeGeneration(raw) ? raw : undefined }));
  };

  const mmField = (key: MmKey, prefix: string, ariaLabel: string, invalid: boolean) => (
    <label
      className={cn(
        fieldBoxClass,
        invalid && !disabled
          ? "border-app-danger"
          : "border-app-border focus-within:border-app-text",
        disabled && "opacity-50"
      )}
    >
      <span className="shrink-0 text-app-muted">{prefix}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalid && !disabled ? true : undefined}
        aria-describedby={helpId}
        disabled={disabled}
        value={textOf(key)}
        onChange={(event) => changeMm(key, event.target.value)}
        className={bareControlClass}
      />
      <span className="shrink-0 text-app-muted">mm</span>
    </label>
  );

  return (
    <div className={className}>
      {label ? (
        <p className="mb-1.5 text-[13px] leading-[18px] text-app-muted">{label}</p>
      ) : null}
      <div className="flex gap-2">
        {mmField("sireMm", "부", "부 크기(mm)", sireInvalid)}
        {mmField("damMm", "모", "모 크기(mm)", damInvalid)}
        <label
          className={cn(
            fieldBoxClass,
            "border-app-border focus-within:border-app-text",
            disabled && "opacity-50"
          )}
        >
          <span className="shrink-0 text-app-muted">누대</span>
          <select
            aria-label="누대"
            disabled={disabled}
            value={value.generation ?? ""}
            onChange={(event) => changeGeneration(event.target.value)}
            className={cn(
              bareControlClass,
              "cursor-pointer appearance-none bg-none pr-5",
              value.generation ? "text-app-text" : "text-app-caption"
            )}
          >
            <option value="" className="text-app-caption">
              선택
            </option>
            {PEDIGREE_GENERATIONS.map((generation) => (
              <option key={generation} value={generation} className="text-app-text">
                {pedigreeGenerationLabel(generation)}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 shrink-0 text-app-caption" />
        </label>
      </div>
      <p
        id={helpId}
        role={hasError ? "alert" : undefined}
        className={cn(
          "mt-1.5 text-[13px] leading-[18px]",
          hasError ? "text-app-danger" : "text-app-muted"
        )}
      >
        {hasError ? PEDIGREE_MM_ERROR_MESSAGE : PEDIGREE_GENERATION_HELP}
      </p>
    </div>
  );
}

export default PedigreeNoteFields;
