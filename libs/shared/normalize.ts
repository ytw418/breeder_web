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
