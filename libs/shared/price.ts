import { formatProductPrice as formatProductPriceRule } from "@libs/productRules";

/**
 * 가격 입력·표시 공용 유틸(앱 bredy_app src/lib/format.ts 와 같은 규칙).
 * - 입력 상태는 숫자 문자열(digits)로 두고 화면에는 콤마를 붙여 보인다.
 */

/** 금액 입력값 정리: 숫자만 남기고 앞자리 0을 뗀다. "01,000" → "1000" */
export function toAmountDigits(text: string): string {
  return text.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

/** 금액 입력 표시: "1234567" → "1,234,567". */
export function formatAmountInput(digits: string): string {
  return toAmountDigits(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 입력 문자열 → 숫자. 비어 있으면 null. "1,000" → 1000, "" → null */
export function parseAmount(text: string | null | undefined): number | null {
  const digits = toAmountDigits(text ?? "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** 상품 가격 표시: 0 → "무료나눔", null/undefined → "가격 미정", 그 외 "1,234원". */
export const formatProductPrice = (price?: number | null): string =>
  formatProductPriceRule(price);
