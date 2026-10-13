import type { RankingPeriod } from "@libs/shared/ranking";

const PERIODS: RankingPeriod[] = ["weekly", "monthly", "all"];

/** 랭킹 API 공통 쿼리: limit(1~50, 기본 50)·period(weekly 기본)·species(대·소분류 이름). */
export function readRankingQuery(query: Record<string, string | string[] | undefined>): {
  limit: number;
  period: RankingPeriod;
  species: string | undefined;
} {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsedLimit = Number(first(query.limit) || "");
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 50) : 50;
  const rawPeriod = first(query.period);
  const period = PERIODS.includes(rawPeriod as RankingPeriod) ? (rawPeriod as RankingPeriod) : "weekly";
  const species = first(query.species)?.trim() || undefined;
  return { limit, period, species };
}
