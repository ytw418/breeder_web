/**
 * 혈통 이름 규칙 한 곳(설계 §3.1). 서버·웹·앱이 같은 함수를 쓴다(앱은 이 파일을 복사한다).
 * - 한글·영문·숫자·띄어쓰기, 2~40자. 앞뒤 공백은 지우고 연속 공백(탭·NBSP 포함)은 하나로 줄인다.
 * - 중복 비교 키는 소문자 + 공백 제거다. "강산 라인" / "강산라인" / "강산  라인" 은 같은 이름이다.
 *   서버 중복 검사 SQL 은 `lower(regexp_replace(name, '\s', '', 'g'))` 로 같은 키를 만든다.
 */

export const BLOODLINE_NAME_MIN_LENGTH = 2;
export const BLOODLINE_NAME_MAX_LENGTH = 40;
/** 정규화한 이름에 적용한다(공백은 한 칸짜리만 남아 있다). */
export const BLOODLINE_NAME_PATTERN = /^[A-Za-z0-9가-힣 ]+$/;
export const BLOODLINE_NAME_RULE_MESSAGE = "이름은 한글·영문·숫자·띄어쓰기로 2~40자예요";
/** 만들기 화면 이름 칸 도움말(입력 전·통과 시). */
export const BLOODLINE_NAME_HELP = "2~40자 · 만든 사람만 이 이름을 쓸 수 있어요";
export const BLOODLINE_NAME_AVAILABLE_MESSAGE = "사용할 수 있는 이름이에요";

export type BloodlineNameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: "empty" | "length" | "pattern" };

/** 앞뒤 공백을 지우고 연속 공백을 한 칸으로 줄인다. 문자열이 아니면 빈 문자열. */
export function normalizeBloodlineName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

/** 중복 비교 키: 소문자 + 모든 공백 제거. */
export function bloodlineNameKey(value: string): string {
  return value.replace(/\s/g, "").toLowerCase();
}

/** 정규화 후 규칙 검사. 통과하면 저장할 이름(정규화 결과)을 준다. */
export function validateBloodlineName(value: unknown): BloodlineNameValidation {
  const name = normalizeBloodlineName(value);
  if (!name) return { ok: false, reason: "empty" };
  if (name.length < BLOODLINE_NAME_MIN_LENGTH || name.length > BLOODLINE_NAME_MAX_LENGTH) {
    return { ok: false, reason: "length" };
  }
  if (!BLOODLINE_NAME_PATTERN.test(name)) return { ok: false, reason: "pattern" };
  return { ok: true, name };
}

export const isValidBloodlineName = (value: unknown) => validateBloodlineName(value).ok;
