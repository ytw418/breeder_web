/**
 * 보호소 아이들 필터 시트의 공고 수(GET /api/products/shelter-facets, 앱 design/mockups/adoption-v2 지역·품종 시트).
 * 보이는 보호소 글(숨김·삭제 제외)만 센다. 시/도·품종 숫자는 서로 다른 필터를 걸지 않은 값이라
 * '지금 고른 조건으로 몇 마리인지'는 목록 응답의 total 이 정답이다(시트 아래 'N마리 보기').
 */
import client from "@libs/server/client";
import { SIDO_SHORT } from "@libs/shared/regions";
import type { ShelterCategory, ShelterFacetsResponse } from "@libs/shared/shelterFilters";

const BREED_LIMIT = 300;

/** 많은 순, 같으면 이름순. */
const byCount = <T extends { name: string; count: number }>(list: T[]): T[] =>
  list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));

export async function getShelterFacets(input: {
  category?: ShelterCategory;
  sido?: string;
}): Promise<ShelterFacetsResponse> {
  const base = {
    externalSource: { not: null },
    isHidden: false,
    isDeleted: false,
    ...(input.category ? { category: input.category } : {}),
  };
  const [sidoRows, sigunguRows, breedRows] = await Promise.all([
    client.product.groupBy({ by: ["regionSido"], where: base, _count: { _all: true } }),
    input.sido
      ? client.product.groupBy({ by: ["regionSigungu"], where: { ...base, regionSido: input.sido }, _count: { _all: true } })
      : Promise.resolve([]),
    input.category
      ? client.product.groupBy({ by: ["externalBreed"], where: { ...base, externalBreed: { not: null } }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  return {
    success: true,
    total: sidoRows.reduce((sum, row) => sum + row._count._all, 0),
    sido: byCount(
      sidoRows
        .filter((row) => row.regionSido)
        .map((row) => ({
          name: row.regionSido as string,
          short: SIDO_SHORT[row.regionSido as string] ?? (row.regionSido as string),
          count: row._count._all,
        }))
    ),
    sigungu: byCount(
      sigunguRows.filter((row) => row.regionSigungu).map((row) => ({ name: row.regionSigungu as string, count: row._count._all }))
    ),
    breed: byCount(
      breedRows.filter((row) => row.externalBreed).map((row) => ({ name: row.externalBreed as string, count: row._count._all }))
    ).slice(0, BREED_LIMIT),
  };
}
