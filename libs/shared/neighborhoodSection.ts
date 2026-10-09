/**
 * 홈 '우리 동네 브리더' 섹션의 상태 판정·문구(앱 docs/prd/home-neighborhood.md, 시안 design/mockups/home-neighborhood).
 * 앱 src/lib/neighborhoodSection.ts 와 같은 내용이다(import 경로만 다르다). 고치면 둘 다 고치고
 * 웹 jest `__tests__/neighborhoodSection.test.ts`·앱 `npm run test:neighborhood-section` 으로 같은 케이스를 돌린다.
 */
import { formatRegionShort } from "./regions";

/** 홈 카드 레일에 보여 줄 최대 인원. 나머지는 '전체 보기'에서 본다. */
export const HOME_NEARBY_LIMIT = 10;

export interface NeighborhoodRegion {
  sido: string;
  sigungu: string;
}

export interface NeighborhoodCardItem {
  user: { id: number; name: string; avatar: string | null };
  region: NeighborhoodRegion;
  postsCount: number;
  commentsCount: number;
  /** 서버가 아직 안 주면 없다(옛 서버). */
  topSpecies?: string[];
  isFollowing?: boolean;
}

export interface NeighborhoodData<T extends NeighborhoodCardItem = NeighborhoodCardItem> {
  scope: "sigungu" | "sido" | "none";
  region: NeighborhoodRegion | null;
  items: T[];
  total?: number;
}

export type NeighborhoodListScope = "sigungu" | "sido";

export type NeighborhoodSectionState<T extends NeighborhoodCardItem = NeighborhoodCardItem> =
  | { kind: "unset"; loggedIn: boolean }
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "none"; region: NeighborhoodRegion; visible: boolean }
  | {
      kind: "filled" | "widened";
      region: NeighborhoodRegion;
      items: T[];
      total: number;
      showVisibleSwitch: boolean;
    };

/**
 * 판정 순서: 비로그인·동네 미설정 → unset(조회하지 않는다) → 데이터 없음이면 오류는 hidden, 아니면 loading →
 * 0명 → none → 시/군/구 filled, 시/도로 넓혔으면 widened. 다시 받다 실패해도 데이터가 있으면 그대로 그린다.
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
  const shownRegion = data.region ?? region;
  if (data.scope === "none" || data.items.length === 0) {
    return { kind: "none", region: shownRegion, visible: regionVisible };
  }
  return {
    kind: data.scope === "sido" ? "widened" : "filled",
    region: shownRegion,
    items: data.items.slice(0, HOME_NEARBY_LIMIT),
    total: data.total ?? data.items.length,
    showVisibleSwitch: !regionVisible,
  };
}

/** 섹션 제목 아래 보조 줄. "강남구 · 12명" / "강남구엔 아직 없어 서울 전체를 보여드려요" / "강남구". 그 밖엔 null. */
export function neighborhoodSubtitle(state: NeighborhoodSectionState): string | null {
  if (state.kind === "filled") return `${state.region.sigungu} · ${state.total}명`;
  if (state.kind === "widened") {
    const sido = formatRegionShort({ sido: state.region.sido }) ?? state.region.sido;
    return `${state.region.sigungu}엔 아직 없어 ${sido} 전체를 보여드려요`;
  }
  if (state.kind === "none") return state.region.sigungu;
  return null;
}

/** 카드 보조 줄: 주력 종(최대 2) 또는 "글 N · 댓글 N". 시/도로 넓혔으면 앞에 구 이름. */
export function neighborhoodCardCaption(
  item: NeighborhoodCardItem,
  scope: NeighborhoodListScope
): string {
  const species = (item.topSpecies ?? []).slice(0, 2);
  const base = species.length
    ? species.join(" · ")
    : `글 ${item.postsCount} · 댓글 ${item.commentsCount}`;
  return scope === "sido" ? `${item.region.sigungu} · ${base}` : base;
}

/** 0명 안내 카드 문구. 내가 이미 표시 중이면 '나를 표시하기' 버튼 없이 인사만 권한다. */
export function neighborhoodNoneCopy(
  region: NeighborhoodRegion,
  visible: boolean
): { title: string; body: string } {
  if (visible) {
    const sido = formatRegionShort({ sido: region.sido }) ?? region.sido;
    return {
      title: `아직 ${sido}에 다른 브리더가 없어요`,
      body: "인사 글을 남기면 동네 이웃이 볼 수 있어요.",
    };
  }
  return {
    title: `${region.sigungu} 첫 동네 브리더가 되어 보세요`,
    body: "'나를 표시'를 켜면 동네 이웃이 나를 찾을 수 있어요. 인사 글을 남기면 반려생활 동네 글에 올라가요.",
  };
}
