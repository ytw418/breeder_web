/**
 * 분양글 상태·거래 유형의 화면 표시 이름(2026-10-10 용어 결정 — '상품·판매' 대신 '분양', 앱 docs/terminology.md).
 * DB·API 값(판매중·예약중·판매완료, sale·adoption·rehoming)은 그대로 두고 화면에만 바꿔 보인다.
 * 앱 bredy_app src/lib/productTerms.ts 와 같은 파일이라 함께 고치고 웹 `npx jest productTerms`·앱 `npm run test:product-terms` 로 확인한다.
 */

/** 분양글 상태 값(서버 Product.status) → 화면 이름. */
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  판매중: "분양중",
  예약중: "예약중",
  판매완료: "분양완료",
};

/** 상태 값을 화면 이름으로 바꾼다. 모르는 값은 그대로, 비어 있으면 빈 문자열. */
export const productStatusLabel = (status: string | null | undefined): string =>
  status ? (PRODUCT_STATUS_LABELS[status] ?? status) : "";

/** 거래 유형 값(서버 Product.dealType) → 화면 이름. 파양은 옛 데이터·관리자 입력용이다. */
export const DEAL_TYPE_LABELS: Record<string, string> = {
  sale: "유료 분양",
  adoption: "무료 분양",
  rehoming: "파양",
};

/** 거래 유형 값을 화면 이름으로 바꾼다. 값이 없으면(구 서버 응답) 유료 분양. */
export const dealTypeLabel = (dealType: string | null | undefined): string =>
  DEAL_TYPE_LABELS[dealType || "sale"] ?? dealType ?? "";
