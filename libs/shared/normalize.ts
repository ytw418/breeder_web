/**
 * 문자열 값을 정규화합니다.
 * - 문자열이 아니거나 비어있으면 null 반환
 * - 앞뒤 공백 제거 후 최대 길이 제한
 */
export const normalizeOptionalText = (value: unknown, max = 120): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

/**
 * URL 값을 정규화합니다.
 * - normalizeOptionalText 적용 후 http(s) 프로토콜이 없으면 https:// 추가
 */
export const normalizeOptionalUrl = (value: unknown): string | null => {
  const normalized = normalizeOptionalText(value, 300);
  if (!normalized) return null;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return `https://${normalized}`;
};

/** Postgres INTEGER(Prisma Int) 상한 */
const MAX_INT_ID = 2_147_483_647;

/**
 * id 로 쓸 양의 정수를 파싱합니다.
 * - number 는 정수만, string 은 숫자로만 이뤄진 경우만 허용(앞뒤 공백 허용)
 * - 1 미만이거나 Postgres INTEGER 상한을 넘으면 null
 */
export const parsePositiveIntId = (value: unknown): number | null => {
  let parsed: number;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    parsed = Number(value.trim());
  } else {
    return null;
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_INT_ID) return null;
  return parsed;
};
