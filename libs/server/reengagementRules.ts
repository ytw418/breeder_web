/**
 * 재방문 알림 규칙(2026-10-23 사용자 결정 "1~4번 한 번에", 앱 docs/prd/reengagement-push.md).
 * DB 를 읽지 않는 순수 규칙만 둔다: 하루 통수 제한, 야간, 문구. 보내는 쪽은 libs/server/reengagement.ts.
 * - 네 종류(동네 무료 분양·토론 마감·관심 분야 새 분양 묶음·답 없는 질문)를 합쳐 한 사람 하루(KST) 2통, 종류마다 1통.
 * - 21시~8시(KST)에는 푸시를 보내지 않는다(정보통신망법 야간 전송 기준을 따른다). 동네 무료 분양은 알림 행만 쌓고,
 *   크론 작업(토론 마감·묶음·질문)은 그 시간에 돌지 않는다.
 */

export const REENGAGEMENT_TYPES = [
  "NEARBY_FREE_PRODUCT",
  "DEBATE_CLOSING",
  "INTEREST_PRODUCTS",
  "QUESTION_HELP",
] as const;

export type ReengagementType = (typeof REENGAGEMENT_TYPES)[number];

/** 한 사람이 하루(KST)에 받는 재방문 알림 합계 상한. */
export const REENGAGEMENT_DAILY_LIMIT = 2;

/** 푸시를 쉬는 시간(KST 시, [start, end)). */
export const REENGAGEMENT_NIGHT = { start: 21, end: 8 } as const;

export function isReengagementNight(now: Date = new Date()): boolean {
  const hour = (now.getUTCHours() + 9) % 24;
  return hour >= REENGAGEMENT_NIGHT.start || hour < REENGAGEMENT_NIGHT.end;
}

/** KST 오늘 0시(UTC Date). */
export function kstDayStartOf(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000);
}

/**
 * 오늘 받은 재방문 알림(rows)을 보고 이번 type 을 받을 수 있는 사람만 남긴다.
 * 합계가 상한에 닿았거나 같은 type 을 이미 받았으면 뺀다. 순서는 그대로 둔다.
 */
export function withinDailyCap(
  userIds: readonly number[],
  todayRows: readonly { userId: number; type: string }[],
  type: ReengagementType,
  limit: number = REENGAGEMENT_DAILY_LIMIT
): number[] {
  const total = new Map<number, number>();
  const sameType = new Set<number>();
  for (const row of todayRows) {
    total.set(row.userId, (total.get(row.userId) ?? 0) + 1);
    if (row.type === type) sameType.add(row.userId);
  }
  return Array.from(new Set(userIds)).filter((id) => !sameType.has(id) && (total.get(id) ?? 0) < limit);
}

/** 무료 분양: 거래 유형 무료 분양(adoption)이거나 가격 0원. 화면 '무료 분양' 표시와 같은 기준(libs/shared/price.ts). */
export function isFreeProduct(product: { dealType?: string | null; price?: number | null }): boolean {
  return product.dealType === "adoption" || product.price === 0;
}

const clip = (text: string, max: number) => {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
};

export interface PushCopy {
  /** 알림 목록에 남는 문구 */
  message: string;
  title: string;
  body: string;
}

/** ① 동네 무료 분양. '강남구에 레오파드 게코 무료 분양이 올라왔어요' */
export function nearbyFreeCopy({
  sigungu,
  species,
  title,
}: {
  sigungu: string;
  species?: string | null;
  title: string;
}): PushCopy {
  const what = species?.trim() ? `${species.trim()} 무료 분양` : "무료 분양";
  const headline = `${sigungu}에 ${what}이 올라왔어요`;
  return {
    message: `${headline}: ${clip(title, 40)}`,
    title: headline,
    body: `${clip(title, 40)} · 바로 확인해 보세요`,
  };
}

/** 마감까지 남은 시간 문구. 60분 이상은 '1시간', 그 아래는 10분 단위로 올림('40분'). */
export function closingLeftLabel(endsAt: Date, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.round((endsAt.getTime() - now.getTime()) / 60_000));
  if (minutes >= 55) return `${Math.max(1, Math.round(minutes / 60))}시간`;
  return `${Math.max(10, Math.ceil(minutes / 10) * 10)}분`;
}

/** 찬성 쪽 비율(반올림 정수). 표가 없으면 50. */
export function sidePercent(aVotes: number, bVotes: number): [number, number] {
  const total = aVotes + bVotes;
  if (total <= 0) return [50, 50];
  const a = Math.round((aVotes / total) * 100);
  return [a, 100 - a];
}

/** ② HOT 토론 마감 임박. '실시간 HOT 토론이 1시간 뒤 마감돼요!' */
export function debateClosingCopy({
  question,
  optionA,
  optionB,
  aVotes,
  bVotes,
  endsAt,
  now = new Date(),
}: {
  question: string;
  optionA: string;
  optionB: string;
  aVotes: number;
  bVotes: number;
  endsAt: Date;
  now?: Date;
}): PushCopy {
  const left = closingLeftLabel(endsAt, now);
  const [a, b] = sidePercent(aVotes, bVotes);
  return {
    message: `${left} 뒤 마감되는 HOT 토론이에요: ${clip(question, 40)}`,
    title: `실시간 HOT 토론이 ${left} 뒤 마감돼요!`,
    body: `${clip(question, 40)} · 지금 ${optionA} ${a}% : ${optionB} ${b}%`,
  };
}

/** ③ 관심 분야 새 분양 묶음. '오늘 크레스티드 게코 새 분양 5건이 올라왔어요' */
export function interestProductsCopy({
  scopeLabel,
  titles,
  count,
}: {
  scopeLabel: string;
  titles: readonly string[];
  count: number;
}): PushCopy {
  const headline = `오늘 ${scopeLabel ? `${scopeLabel} ` : ""}새 분양 ${count}건이 올라왔어요`;
  return {
    message: headline,
    title: headline,
    body: titles.length ? titles.slice(0, 3).map((t) => clip(t, 24)).join(" / ") : "분양 탭에서 확인해 보세요",
  };
}

/** ④ 답 없는 질문. '레오파드 게코 질문에 아직 답이 없어요' */
export function questionHelpCopy({ species, title }: { species?: string | null; title: string }): PushCopy {
  const headline = species?.trim() ? `${species.trim()} 질문에 아직 답이 없어요` : "아직 답이 없는 질문이 있어요";
  return {
    message: `${headline}: ${clip(title, 40)}`,
    title: headline,
    body: `${clip(title, 40)} · 키워 본 경험을 나눠 주세요`,
  };
}
