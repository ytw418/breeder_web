import type { BloodlineRankingItem, BreederRankingItem } from "@libs/shared/ranking";

/** 반려생활 TOP 브리더 행의 '○○ 부자' 키워드(앱 src/lib/breederKeywords.ts). 앞에 있을수록 동점일 때 먼저 고른다. */
const KEYWORD_STATS = [
  { name: "혈통", emoji: "🧬", stat: "bloodlines", unit: "개" },
  { name: "댓글", emoji: "💬", stat: "commentsCount", unit: "개" },
  { name: "게시글", emoji: "✍️", stat: "postsCount", unit: "개" },
  { name: "경매", emoji: "🔨", stat: "sellerEndedAuctionsCount", unit: "건" },
  { name: "낙찰", emoji: "🏆", stat: "auctionWinsCount", unit: "건" },
  { name: "입찰", emoji: "🙋", stat: "bidsCount", unit: "회" },
] as const;

export interface BreederKeyword {
  /** 예: "댓글 부자" */
  label: string;
  emoji: string;
  /** 키워드 근거. 예: "댓글 13개" */
  detail: string;
}

type StatKey = (typeof KEYWORD_STATS)[number]["stat"];

/**
 * 상위 `count` 명에게 키워드를 하나씩 붙인다.
 * 각 지표를 랭킹 전체의 최댓값으로 나눈 비율이 가장 큰 지표를 고르고, 앞 순위가 가져간
 * 지표는 다시 쓰지 않는다(세 명이 모두 '댓글 부자'가 되지 않게). 값이 0인 지표는 고르지 않는다.
 * 혈통 수는 혈통 랭킹(상위 50)에서 그 사람이 만든 혈통 개수다.
 */
export function pickBreederKeywords(
  breeders: BreederRankingItem[],
  bloodlines: BloodlineRankingItem[],
  count: number
): (BreederKeyword | null)[] {
  const bloodlineCount = new Map<number, number>();
  for (const b of bloodlines) {
    bloodlineCount.set(b.creator.id, (bloodlineCount.get(b.creator.id) ?? 0) + 1);
  }
  const valueOf = (item: BreederRankingItem, stat: StatKey) =>
    stat === "bloodlines" ? bloodlineCount.get(item.user.id) ?? 0 : item[stat];

  const max = new Map<StatKey, number>(
    KEYWORD_STATS.map(({ stat }) => [stat, Math.max(0, ...breeders.map((item) => valueOf(item, stat)))])
  );

  const taken = new Set<StatKey>();
  return breeders.slice(0, count).map((item) => {
    let best: (typeof KEYWORD_STATS)[number] | null = null;
    let bestValue = 0;
    let bestRatio = 0;
    for (const entry of KEYWORD_STATS) {
      if (taken.has(entry.stat)) continue;
      const top = max.get(entry.stat) ?? 0;
      const value = valueOf(item, entry.stat);
      if (top <= 0 || value <= 0) continue;
      const ratio = value / top;
      if (ratio > bestRatio) {
        best = entry;
        bestValue = value;
        bestRatio = ratio;
      }
    }
    if (!best) return null;
    taken.add(best.stat);
    return {
      label: `${best.name} 부자`,
      emoji: best.emoji,
      detail: `${best.name} ${bestValue.toLocaleString()}${best.unit}`,
    };
  });
}
