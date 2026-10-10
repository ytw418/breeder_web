/**
 * 상품·경매에 붙이는 혈통 메모(pedigreeNote) 값 범위와 표시(설계 §2.4).
 * 앱 src/lib/pedigreeNote.ts 와 같은 규칙이다(이 파일을 복사한다).
 * - sireMm·damMm: 숫자(문자열 숫자 허용), 소수 첫째 자리까지, 1~500.
 * - generation: F1~F9 또는 unknown(모름).
 * - 세 값이 모두 비면 null. 모르는 키는 버린다(저장 전에 화이트리스트로 다시 만든다).
 */

export const PEDIGREE_GENERATIONS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "unknown"] as const;
export type PedigreeGeneration = (typeof PEDIGREE_GENERATIONS)[number];

export interface PedigreeNote {
  sireMm?: number;
  damMm?: number;
  generation?: PedigreeGeneration;
}

/** 포함 */
export const PEDIGREE_MM_MIN = 1;
/** 포함. 곤충·파충류·포유류를 다 덮는 느슨한 상한 */
export const PEDIGREE_MM_MAX = 500;

export const PEDIGREE_NOTE_INVALID_MESSAGE = "부·모 크기와 누대를 다시 확인해 주세요";
export const PEDIGREE_WITHOUT_BLOODLINE_MESSAGE = "혈통을 먼저 골라 주세요";
export const PEDIGREE_GENERATION_HELP = "야생 채집 개체(WD)의 자식이 F1이에요. 모르면 '모름'을 골라요.";

export type PedigreeNoteField = "sireMm" | "damMm" | "generation" | "pedigreeNote";

export type PedigreeNoteParseResult =
  | { ok: true; value: PedigreeNote | null }
  | { ok: false; field: PedigreeNoteField };

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

export const isPedigreeGeneration = (value: unknown): value is PedigreeGeneration =>
  typeof value === "string" && (PEDIGREE_GENERATIONS as readonly string[]).includes(value);

/** 1~500, 소수 첫째 자리까지인 유한한 숫자인지. */
export function isValidPedigreeMm(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= PEDIGREE_MM_MIN &&
    value <= PEDIGREE_MM_MAX &&
    Math.round(value * 10) / 10 === value
  );
}

/** 숫자 또는 숫자 문자열 → 숫자. 그 밖의 타입이나 숫자가 아닌 문자열이면 NaN. */
const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.trim());
  return Number.NaN;
};

/**
 * 요청 값 검사·정리. 비어 있으면 `{ ok: true, value: null }`, 규칙 위반이면 처음 걸린 칸을 준다.
 * 객체가 아니면(배열·문자열·숫자) `field: "pedigreeNote"`.
 */
export function parsePedigreeNote(input: unknown): PedigreeNoteParseResult {
  if (input === undefined || input === null) return { ok: true, value: null };
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, field: "pedigreeNote" };

  const raw = input as Record<string, unknown>;
  const note: PedigreeNote = {};

  if (!isBlank(raw.sireMm)) {
    const sireMm = toNumber(raw.sireMm);
    if (!isValidPedigreeMm(sireMm)) return { ok: false, field: "sireMm" };
    note.sireMm = sireMm;
  }
  if (!isBlank(raw.damMm)) {
    const damMm = toNumber(raw.damMm);
    if (!isValidPedigreeMm(damMm)) return { ok: false, field: "damMm" };
    note.damMm = damMm;
  }
  if (!isBlank(raw.generation)) {
    if (!isPedigreeGeneration(raw.generation)) return { ok: false, field: "generation" };
    note.generation = raw.generation;
  }

  if (note.sireMm === undefined && note.damMm === undefined && note.generation === undefined) {
    return { ok: true, value: null };
  }
  return { ok: true, value: note };
}

export const pedigreeGenerationLabel = (generation: PedigreeGeneration) =>
  generation === "unknown" ? "모름" : generation;

/** 81.2 → "81.2", 80 → "80" */
const formatMm = (value: number) => String(Math.round(value * 10) / 10);

/**
 * 표시 문자열 "누대 F3 · 부 81.2mm · 모 47.5mm"(있는 것만, 이 순서). 비면 빈 문자열.
 * 분양글·경매 상세 2줄째는 여기에 " · 분양자 입력" 을 붙인다.
 */
export function formatPedigreeNote(note?: PedigreeNote | null): string {
  if (!note) return "";
  const parts: string[] = [];
  if (note.generation) parts.push(`누대 ${pedigreeGenerationLabel(note.generation)}`);
  if (typeof note.sireMm === "number") parts.push(`부 ${formatMm(note.sireMm)}mm`);
  if (typeof note.damMm === "number") parts.push(`모 ${formatMm(note.damMm)}mm`);
  return parts.join(" · ");
}
