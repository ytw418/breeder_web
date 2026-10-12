/**
 * 동네 범위: 시 단위 + 반경 50km(앱 docs/prd/community-vibe.md §3.6b).
 * 사용자가 고르는 값은 그대로 시/도 + 시/군/구다. 바뀌는 건 보여 주는 범위와 라벨이다.
 * - 라벨: 특별시·광역시·특별자치시는 시 이름만("서울"), 도의 시는 "수원시", 군은 "보은군 근처". 구 이름은 범위 라벨에 쓰지 않는다.
 * - 범위: 내 시/군/구 중심에서 반경 NEIGHBOR_RADIUS_KM 안에 중심이 있는 시/군/구 + 같은 특별·광역시의 모든 구·군.
 * 앱 `src/lib/regionScope.ts` 와 같은 사본이다. 고치면 둘 다 고치고 웹 jest `regionScope`·앱 `npm run test:region-scope` 를 돌린다.
 */
import { NEIGHBOR_RADIUS_KM } from "./communityVibe";
import { haversineKm, regionCentroid } from "./regionCentroids";
import { REGIONS, SIDO_SHORT, isMetropolitanSido } from "./regions";

export { NEIGHBOR_RADIUS_KM };

export interface ScopedRegion {
  sido: string;
  sigungu: string;
  /** 내 시/군/구 중심과의 거리(km, 정수). 같은 시/군/구면 0. */
  distanceKm: number;
}

/** "서울" | "대전" | "세종" | "수원시" | "보은군 근처". 동네가 없으면 빈 문자열. */
export function regionScopeLabel(sido: string | null | undefined, sigungu: string | null | undefined): string {
  if (!sido) return "";
  if (isMetropolitanSido(sido)) return SIDO_SHORT[sido] ?? sido;
  if (!sigungu) return SIDO_SHORT[sido] ?? sido;
  if (sigungu.endsWith("군")) return `${sigungu} 근처`;
  return sigungu;
}

/**
 * 내 범위 안 시/군/구 목록(가까운 순). 내 시/군/구가 맨 앞(0km)이다.
 * 같은 특별·광역시 안의 구·군은 거리와 무관하게 넣는다. 좌표를 모르는 조합이면 내 시/군/구 하나만.
 */
export function nearbyRegions(
  sido: string,
  sigungu: string,
  radiusKm: number = NEIGHBOR_RADIUS_KM,
): ScopedRegion[] {
  const origin = regionCentroid(sido, sigungu);
  if (!origin) return [{ sido, sigungu, distanceKm: 0 }];
  const metro = isMetropolitanSido(sido);
  const result: ScopedRegion[] = [];
  for (const entry of REGIONS) {
    for (const name of entry.sigungu) {
      const point = regionCentroid(entry.sido, name);
      if (!point) continue;
      const same = entry.sido === sido && name === sigungu;
      const km = same ? 0 : haversineKm(origin, point);
      const inMetro = metro && entry.sido === sido;
      if (same || inMetro || km <= radiusKm) {
        result.push({ sido: entry.sido, sigungu: name, distanceKm: Math.round(km) });
      }
    }
  }
  return result.sort(
    (a, b) =>
      Number(b.sido === sido && b.sigungu === sigungu) - Number(a.sido === sido && a.sigungu === sigungu) ||
      a.distanceKm - b.distanceKm,
  );
}

/** 두 시/군/구 중심 사이 거리(km, 정수). 같은 곳이면 0, 좌표를 모르면 null. */
export function regionDistanceKm(
  a: { sido: string | null | undefined; sigungu: string | null | undefined },
  b: { sido: string | null | undefined; sigungu: string | null | undefined },
): number | null {
  if (a.sido && a.sido === b.sido && a.sigungu === b.sigungu) return 0;
  const pa = regionCentroid(a.sido, a.sigungu);
  const pb = regionCentroid(b.sido, b.sigungu);
  if (!pa || !pb) return null;
  return Math.round(haversineKm(pa, pb));
}

/** Prisma where 조각용: 시/도별로 묶은 시/군/구 목록. */
export function groupRegionsBySido(regions: ReadonlyArray<{ sido: string; sigungu: string }>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const region of regions) {
    const list = map.get(region.sido) ?? [];
    list.push(region.sigungu);
    map.set(region.sido, list);
  }
  return map;
}

/** 시/군/구 범위를 Prisma OR 조건으로(필드 이름은 User·Post 같은 regionSido/regionSigungu). */
export function regionScopeOr(
  regions: ReadonlyArray<{ sido: string; sigungu: string }>,
): Array<{ regionSido: string; regionSigungu: { in: string[] } }> {
  return Array.from(groupRegionsBySido(regions), ([regionSido, list]) => ({
    regionSido,
    regionSigungu: { in: list },
  }));
}
