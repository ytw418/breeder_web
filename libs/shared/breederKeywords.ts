import {
  BREEDER_SCORE_WEIGHTS,
  SCOPED_BREEDER_SCORE_WEIGHTS,
  type BloodlineRankingItem,
  type BreederRankingItem,
} from "@libs/shared/ranking";

/**
 * 반려생활 TOP 브리더 행의 '○○ 부자' 키워드(앱 src/lib/breederKeywords.ts). 앞에 있을수록 동점일 때 먼저 고른다.
 * `scored` 는 랭킹 점수에 들어가는 활동이다(활동 요약에 보여 준다).
 */
const KEYWORD_STATS = [
  { name: "혈통", emoji: "🧬", stat: "bloodlines", unit: "개", scored: false },
  {
    name: "댓글",
    emoji: "💬",
    stat: "commentsCount",
    unit: "개",
    scored: true,
  },
  { name: "게시글", emoji: "✍️", stat: "postsCount", unit: "개", scored: true },
  {
    name: "상품",
    emoji: "📦",
    stat: "productsCount",
    unit: "개",
    scored: true,
  },
  {
    name: "경매",
    emoji: "🔨",
    stat: "sellerEndedAuctionsCount",
    unit: "건",
    scored: true,
  },
  {
    name: "낙찰",
    emoji: "🏆",
    stat: "auctionWinsCount",
    unit: "건",
    scored: true,
  },
  { name: "입찰", emoji: "🙋", stat: "bidsCount", unit: "회", scored: true },
  { name: "사진", emoji: "📷", stat: "photosCount", unit: "장", scored: false },
  {
    name: "좋아요",
    detailName: "받은 좋아요",
    emoji: "❤️",
    stat: "likesReceivedCount",
    unit: "개",
    scored: false,
  },
  {
    name: "팔로워",
    emoji: "👥",
    stat: "followersCount",
    unit: "명",
    scored: false,
  },
] as const;

type KeywordEntry = (typeof KEYWORD_STATS)[number];
type StatKey = KeywordEntry["stat"];

/** 활동 요약 순서(점수 기준 시트 순서와 같다). */
const SUMMARY_ORDER: Exclude<StatKey, "bloodlines">[] = [
  "postsCount",
  "productsCount",
  "commentsCount",
  "bidsCount",
  "auctionWinsCount",
  "sellerEndedAuctionsCount",
];
const SUMMARY_MAX_PARTS = 3;
/** '부자'라고 부를 최소 값. 이보다 작은 지표는 3 이상인 지표가 하나도 없을 때만 고른다('팔로워 1명 부자' 방지). */
const KEYWORD_MIN_VALUE = 3;

export interface BreederKeyword {
  stat: StatKey;
  /** 예: "댓글 부자" */
  label: string;
  emoji: string;
  /** 키워드 근거. 예: "댓글 13개" */
  detail: string;
}

const entryOf = (stat: StatKey) => KEYWORD_STATS.find((entry) => entry.stat === stat) as KeywordEntry;

const formatStat = (entry: KeywordEntry, value: number) =>
  `${"detailName" in entry ? entry.detailName : entry.name} ${value.toLocaleString()}${entry.unit}`;

/** 혈통 외 지표 값. 혈통 수는 pickBreederKeywords 가 혈통 랭킹으로 센다. */
const statValue = (item: BreederRankingItem, stat: Exclude<StatKey, "bloodlines">) => {
  if (stat === "photosCount" || stat === "likesReceivedCount" || stat === "followersCount") {
    return item.highlight?.[stat] ?? 0;
  }
  return item[stat] ?? 0;
};

/**
 * 상위 `count` 명에게 키워드를 하나씩 붙인다.
 * 각 지표를 랭킹 전체의 최댓값으로 나눈 비율이 가장 큰 지표를 고르고, 앞 순위가 가져간 지표는 되도록 다시 쓰지
 * 않는다(세 명이 모두 '댓글 부자'가 되지 않게). 고르는 순서: ① 안 가져간 지표 중 값이 3 이상 ② 가져간 지표 포함
 * 3 이상 ③ 0보다 큰 아무 지표. 그래서 활동이 있으면 빈칸이 생기지 않는다. 값이 0인 지표는 고르지 않는다. 혈통 수는 혈통 랭킹(상위 50)에서 그 사람이 만든 혈통 개수다.
 * 사진·받은 좋아요·팔로워는 서버가 `highlight` 를 붙인 사람만 값이 있다.
 */
export function pickBreederKeywords(
  breeders: BreederRankingItem[],
  bloodlines: BloodlineRankingItem[],
  count: number,
): (BreederKeyword | null)[] {
  const bloodlineCount = new Map<number, number>();
  for (const b of bloodlines) {
    bloodlineCount.set(b.creator.id, (bloodlineCount.get(b.creator.id) ?? 0) + 1);
  }
  const valueOf = (item: BreederRankingItem, stat: StatKey) =>
    stat === "bloodlines" ? bloodlineCount.get(item.user.id) ?? 0 : statValue(item, stat);

  const max = new Map<StatKey, number>(
    KEYWORD_STATS.map(({ stat }) => [stat, Math.max(0, ...breeders.map((item) => valueOf(item, stat)))]),
  );

  const pick = (item: BreederRankingItem, skip: Set<StatKey>, minValue: number) => {
    let best: KeywordEntry | null = null;
    let bestValue = 0;
    let bestRatio = 0;
    for (const entry of KEYWORD_STATS) {
      if (skip.has(entry.stat)) continue;
      const top = max.get(entry.stat) ?? 0;
      const value = valueOf(item, entry.stat);
      if (top <= 0 || value <= 0 || value < minValue) continue;
      const ratio = value / top;
      if (ratio > bestRatio) {
        best = entry;
        bestValue = value;
        bestRatio = ratio;
      }
    }
    return best ? { entry: best, value: bestValue } : null;
  };

  const taken = new Set<StatKey>();
  return breeders.slice(0, count).map((item) => {
    const best =
      pick(item, taken, KEYWORD_MIN_VALUE) ?? pick(item, new Set(), KEYWORD_MIN_VALUE) ?? pick(item, new Set(), 0);
    if (!best) return null;
    taken.add(best.entry.stat);
    return {
      stat: best.entry.stat,
      label: `${best.entry.name} 부자`,
      emoji: best.entry.emoji,
      detail: formatStat(best.entry, best.value),
    };
  });
}

/**
 * 이름 아래 활동 요약. 예: "게시글 16개 · 입찰 2회 · 낙찰 1건".
 * 점수에 들어간 활동 중 0이 아닌 것을 순서대로 보여 주고, 키워드 근거가 점수 활동이 아니면(혈통·사진·좋아요·팔로워)
 * 끝에 붙인다. 최대 세 개. 카테고리 범위 랭킹은 서버가 게시글·상품만 채우므로 그 둘만 나온다.
 */
export function summarizeBreederActivity(item: BreederRankingItem, keyword: BreederKeyword | null): string {
  const parts = SUMMARY_ORDER.flatMap((stat) => {
    const value = statValue(item, stat);
    return value > 0 ? [formatStat(entryOf(stat), value)] : [];
  });
  if (keyword && !entryOf(keyword.stat).scored) {
    return [...parts.slice(0, SUMMARY_MAX_PARTS - 1), keyword.detail].join(" · ");
  }
  return parts.slice(0, SUMMARY_MAX_PARTS).join(" · ");
}

export interface BreederScoreRule {
  label: string;
  /** 보조 설명. 예: "내가 이긴 경매" */
  hint?: string;
  points: number;
}

/**
 * '점수 기준' 시트 행. 서버 점수식(scoreBreeder·scoreScopedBreeder)과 같은 가중치를 쓴다.
 * 관심 카테고리 범위 랭킹이면 범위 안 게시글·상품(가중치가 0 이 아닌 경매·혈통 포함)만 센다.
 */
export function getBreederScoreRules(scoped: boolean): BreederScoreRule[] {
  if (scoped) {
    const w = SCOPED_BREEDER_SCORE_WEIGHTS;
    return [
      { label: "게시글 1개", points: w.post },
      { label: "상품 1개", hint: "판매·분양", points: w.product },
      { label: "경매 1건", points: w.auction },
      { label: "혈통 1개", hint: "내가 만든 혈통", points: w.bloodline },
    ].filter((rule) => rule.points > 0);
  }
  const w = BREEDER_SCORE_WEIGHTS;
  return [
    { label: "게시글 1개", points: w.post },
    { label: "댓글 1개", points: w.comment },
    { label: "경매 입찰 1회", points: w.bid },
    { label: "경매 낙찰 1건", hint: "내가 이긴 경매", points: w.auctionWin },
    {
      label: "경매 거래 성사 1건",
      hint: "내가 연 경매",
      points: w.sellerEndedAuction,
    },
  ];
}
