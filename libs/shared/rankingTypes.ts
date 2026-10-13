/**
 * 랭킹 화면 구성(2026-10-12 사용자 결정): 종합 브리더 + 인기 혈통·경매 활동·분양, 기간 역대·이번 주·이번 달,
 * 종은 대분류·소분류 둘 다. '분양'은 일단 분양글 수로 세고 나중에 분양 완료 수로 바꾼다(LISTING_METRIC 한 곳).
 * 앱 bredy_app src/lib/rankingTypes.ts 와 같은 사본이다. 함께 고치고 웹 jest·앱 npm run test:ranking-types 로 확인한다.
 */
export type RankingTypeId = "breeders" | "bloodlines" | "auctions" | "listings";

export const RANKING_TYPES: ReadonlyArray<{ id: RankingTypeId; label: string }> = [
  { id: "breeders", label: "종합 브리더" },
  { id: "bloodlines", label: "인기 혈통" },
  { id: "auctions", label: "경매 활동" },
  { id: "listings", label: "분양" },
];

export type RankingPeriodId = "all" | "weekly" | "monthly";

export const RANKING_PERIODS: ReadonlyArray<{ id: RankingPeriodId; label: string }> = [
  { id: "all", label: "역대" },
  { id: "weekly", label: "이번 주" },
  { id: "monthly", label: "이번 달" },
];

export const DEFAULT_RANKING_TYPE: RankingTypeId = "breeders";
export const DEFAULT_RANKING_PERIOD: RankingPeriodId = "weekly";

export const isRankingType = (value: unknown): value is RankingTypeId =>
  RANKING_TYPES.some((type) => type.id === value);

export const isRankingPeriodId = (value: unknown): value is RankingPeriodId =>
  RANKING_PERIODS.some((period) => period.id === value);

/** 경매 활동 점수: 입찰 2 · 경매 등록 3 · 낙찰 10. */
export const AUCTION_ACTIVITY_WEIGHTS = { bid: 2, listed: 3, win: 10 } as const;

export function scoreAuctionActivity(counts: { bidsCount: number; listedCount: number; winsCount: number }): number {
  return (
    counts.bidsCount * AUCTION_ACTIVITY_WEIGHTS.bid +
    counts.listedCount * AUCTION_ACTIVITY_WEIGHTS.listed +
    counts.winsCount * AUCTION_ACTIVITY_WEIGHTS.win
  );
}

/**
 * 분양 랭킹이 세는 것. "posted" = 기간 안에 올린 분양글 수, "completed" = 기간 안에 분양 완료한 수.
 * 바꿀 때는 이 값만 바꾼다(서버 where 는 libs/server/ranking.ts listingMetricWhere).
 */
export type ListingMetric = "posted" | "completed";
export const LISTING_METRIC: ListingMetric = "posted";
export const LISTING_METRIC_LABEL: Record<ListingMetric, string> = {
  posted: "분양글",
  completed: "분양 완료",
};

const won = (n: number) => n.toLocaleString("ko-KR");

/** 행 보조 문구(점수 옆 회색 한 줄). */
export function rankingRowLabel(
  type: RankingTypeId,
  item: {
    score?: number;
    ownerCount?: number;
    issuedCount?: number;
    bidsCount?: number;
    listedCount?: number;
    winsCount?: number;
    listingsCount?: number;
    metric?: ListingMetric;
  },
  period: RankingPeriodId
): string {
  if (type === "bloodlines") {
    const owners = `${period === "all" ? "보유자" : "새 보유자"} ${won(item.ownerCount ?? 0)}명`;
    return item.issuedCount ? `${owners} · 발급 ${won(item.issuedCount)}장` : owners;
  }
  if (type === "auctions") {
    return [
      `입찰 ${won(item.bidsCount ?? 0)}`,
      `등록 ${won(item.listedCount ?? 0)}`,
      `낙찰 ${won(item.winsCount ?? 0)}`,
    ].join(" · ");
  }
  if (type === "listings") {
    const metric = item.metric ?? LISTING_METRIC;
    const count = won(item.listingsCount ?? 0);
    return metric === "completed" ? `${LISTING_METRIC_LABEL.completed} ${count}건` : `${LISTING_METRIC_LABEL.posted} ${count}개`;
  }
  return `${won(item.score ?? 0)}점`;
}

/** 순위 기준 안내 한 줄. */
export function rankingNote(type: RankingTypeId, period: RankingPeriodId, species: string | null): string {
  const when = period === "weekly" ? "이번 주" : period === "monthly" ? "이번 달" : "지금까지";
  const what = species ? `${species} ` : "";
  if (type === "bloodlines") {
    return period === "all"
      ? `${what}혈통을 가진 사람이 많은 순`
      : `${when} ${what}혈통 카드를 새로 받은 사람이 많은 순`;
  }
  if (type === "auctions") {
    return `${when} ${what}경매 입찰 ${AUCTION_ACTIVITY_WEIGHTS.bid}점 · 등록 ${AUCTION_ACTIVITY_WEIGHTS.listed}점 · 낙찰 ${AUCTION_ACTIVITY_WEIGHTS.win}점`;
  }
  if (type === "listings") {
    return LISTING_METRIC === "completed"
      ? `${when} ${what}분양을 완료한 수가 많은 순`
      : `${when} ${what}분양글을 많이 올린 순`;
  }
  return species
    ? `${when} '${species}' 게시글 1점 · 분양글 3점`
    : `${when} 게시글·댓글·입찰·낙찰 활동 점수`;
}

/** 빈 상태 문구. */
export function rankingEmptyTitle(type: RankingTypeId, period: RankingPeriodId, species: string | null): string {
  const when = period === "weekly" ? "이번 주 " : period === "monthly" ? "이번 달 " : "";
  const what = species ? `${species} ` : "";
  const label = RANKING_TYPES.find((t) => t.id === type)?.label ?? "";
  return `${when}${what}${label} 기록이 아직 없어요`;
}

/**
 * 딥링크·URL 값 → 화면 상태. 모르는 값은 기본값으로, 옛 탭(community)은 종합 브리더로,
 * 소분류(sub)는 고른 대분류의 자식일 때만 남긴다.
 */
export function parseRankingParams(
  params: { tab?: unknown; period?: unknown; species?: unknown; sub?: unknown },
  subcategoriesOf: (parent: string) => readonly string[],
  topLevels: readonly string[]
): { type: RankingTypeId; period: RankingPeriodId; species: string; sub: string } {
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const tab = first(params.tab);
  const period = first(params.period);
  const species = String(first(params.species) ?? "");
  const sub = String(first(params.sub) ?? "");
  const validSpecies = topLevels.includes(species) ? species : "";
  return {
    type: isRankingType(tab) ? tab : DEFAULT_RANKING_TYPE,
    period: isRankingPeriodId(period) ? period : DEFAULT_RANKING_PERIOD,
    species: validSpecies,
    sub: validSpecies && subcategoriesOf(validSpecies).includes(sub) ? sub : "",
  };
}
