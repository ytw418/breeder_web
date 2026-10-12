/**
 * 홈 '우리 동네 브리더' 섹션의 상태 판정·문구(앱 docs/prd/home-neighborhood.md → community-vibe.md §3.6·§3.6b).
 * 2026-10-12: 범위가 시/군/구 → 시 단위 + 반경 50km 로 바뀌어 '시/도로 넓힘(widened)' 상태를 없앴다.
 * 앱 src/lib/neighborhoodSection.ts 와 같은 내용이다(import 경로만 다르다). 고치면 둘 다 고치고
 * 웹 jest `__tests__/neighborhoodSection.test.ts`·앱 `npm run test:neighborhood-section` 으로 같은 케이스를 돌린다.
 */
import { nearLabel, neighborhoodEmptyCopy, type EmptyCopy } from "./communityCopy";

/** 홈 카드 레일에 보여 줄 최대 인원. 나머지는 '전체 보기'에서 본다. */
export const HOME_NEARBY_LIMIT = 10;

export interface NeighborhoodRegion {
  sido: string;
  sigungu: string;
}

/** 계약 NearbyBreederItem 에서 카드가 쓰는 부분. */
export interface NeighborhoodCardItem {
  id: number;
  name: string;
  /** 주력 종 하나(서버 `species`). 옛 `topSpecies` 배열은 읽지 않는다. */
  species: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
  distanceKm: number;
  sameRegion: boolean;
  isFollowing: boolean;
}

/** 계약 NearbyBreedersResult 에서 섹션이 쓰는 부분. */
export interface NeighborhoodData<T extends NeighborhoodCardItem = NeighborhoodCardItem> {
  scope: "near" | "none";
  regionLabel: string;
  total: number;
  greetingCount: number;
  items: T[];
}

export type NeighborhoodSectionState<T extends NeighborhoodCardItem = NeighborhoodCardItem> =
  | { kind: "unset"; loggedIn: boolean }
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "none"; regionLabel: string; visible: boolean }
  | {
      kind: "filled";
      regionLabel: string;
      items: T[];
      total: number;
      greetingCount: number;
      showVisibleSwitch: boolean;
    };

/**
 * 판정 순서: 비로그인·동네 미설정 → unset(조회하지 않는다) → 데이터 없음이면 오류는 hidden, 아니면 loading →
 * 50km 안 0명 → none → filled. 다시 받다 실패해도 데이터가 있으면 그대로 그린다.
 */
export function resolveNeighborhoodSection<T extends NeighborhoodCardItem>(input: {
  loggedIn: boolean;
  region: NeighborhoodRegion | null;
  regionVisible: boolean;
  data: NeighborhoodData<T> | undefined;
  isError: boolean;
}): NeighborhoodSectionState<T> {
  const { loggedIn, region, regionVisible, data, isError } = input;
  if (!loggedIn || !region) return { kind: "unset", loggedIn };
  if (!data) return isError ? { kind: "hidden" } : { kind: "loading" };
  if (data.scope === "none" || data.items.length === 0) {
    return { kind: "none", regionLabel: data.regionLabel, visible: regionVisible };
  }
  return {
    kind: "filled",
    regionLabel: data.regionLabel,
    items: data.items.slice(0, HOME_NEARBY_LIMIT),
    total: data.total ?? data.items.length,
    greetingCount: data.greetingCount ?? 0,
    showVisibleSwitch: !regionVisible,
  };
}

/**
 * 섹션 제목 아래 보조 줄. "서울 근처 브리더 12명 · 이번 주 인사 글 3개"(인사 글 0이면 앞부분만).
 * 숫자만 주황으로 칠할 수 있게 화면은 이 문자열 대신 neighborhoodSubtitleParts 를 써도 된다. 그 밖엔 null.
 */
export function neighborhoodSubtitle(state: NeighborhoodSectionState): string | null {
  if (state.kind !== "filled") return null;
  const head = `${nearLabel(state.regionLabel)} 브리더 ${state.total}명`;
  return state.greetingCount > 0 ? `${head} · 이번 주 인사 글 ${state.greetingCount}개` : head;
}

/** 카드 보조 줄: 주력 종 하나. 없으면 null. */
export function neighborhoodCardCaption(item: Pick<NeighborhoodCardItem, "species">): string | null {
  return item.species || null;
}

/** 카드 위치 줄: 같은 시/군/구면 "같은 동네", 아니면 "구로구 · 2km"(1km 미만은 1km). */
export function neighborhoodCardLocation(
  item: Pick<NeighborhoodCardItem, "sameRegion" | "regionSido" | "regionSigungu" | "distanceKm">
): string {
  if (item.sameRegion) return "같은 동네";
  const place = item.regionSigungu === item.regionSido ? item.regionSido : item.regionSigungu;
  return `${place ?? ""} · ${Math.max(1, item.distanceKm)}km`.trim();
}

/** 0명 안내 카드 문구(§3.1). visitors 는 GET /api/neighborhood/visitors 의 count(모르면 0). */
export function neighborhoodNoneCopy(regionLabel: string, visitors = 0): EmptyCopy {
  return neighborhoodEmptyCopy(regionLabel, visitors);
}
