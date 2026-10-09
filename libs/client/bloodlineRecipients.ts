/**
 * 혈통 v2 받은 사람·분양글 화면 문구·필터(앱 src/lib/bloodlineLabels.ts recipientRowMeta·recipientsSummaryText,
 * bloodline-management/card/[cardId]/listings.tsx getBloodlineListingsPage 와 같은 규칙).
 */
import { formatBloodlineIssuedAt, type BloodlineRecipientItem } from "@libs/shared/bloodline-card";

/** "받은 사람 3명" */
export const bloodlineReceivedCountText = (count: number) => `받은 사람 ${count}명`;

/** 받은 사람 행 메타: "출처 카드 받음 · 2026.09.12" / "재분양으로 이어받음 · …"(날짜가 없으면 앞부분만). */
export function recipientRowMeta(recipient: Pick<BloodlineRecipientItem, "via" | "receivedAt">): string {
  const how = recipient.via === "rehomed" ? "재분양으로 이어받음" : "출처 카드 받음";
  const date = formatBloodlineIssuedAt(recipient.receivedAt);
  return date ? `${how} · ${date}` : how;
}

/** 상세 "받은 사람 N명 ›" 행 오른쪽: 첫 공개 이름 기준 "도윤파파 외 2"(N=1 이면 이름만). 공개 이름이 없으면 null. */
export function recipientsSummaryText(
  recipients: readonly Pick<BloodlineRecipientItem, "user">[],
  total: number
): string | null {
  const first = recipients.find((r) => r.user && !r.user.masked && r.user.name?.trim());
  if (!first) return null;
  const name = first.user.name.trim();
  return total > 1 ? `${name} 외 ${total - 1}` : name;
}

/**
 * 이 혈통 분양글 한 페이지. 구 서버가 bloodlineRootId 필터를 무시하고 전체 상품을 주면 다른 상품이 섞이지 않게
 * 한 번 더 거르고, 한 장도 남지 않으면 더 받지 않게 pages 를 지금 페이지로 줄인다.
 */
export function filterBloodlineListingsPage<T extends { bloodlineRootId?: number | null }>(
  rootId: number,
  page: number,
  data: { products?: T[]; pages?: number }
): { products: T[]; pages: number } {
  const raw = data.products ?? [];
  const products = raw.filter((product) => product.bloodlineRootId === rootId);
  const filterIgnored = raw.length > 0 && products.length === 0;
  return { products, pages: filterIgnored ? page : data.pages ?? 1 };
}
