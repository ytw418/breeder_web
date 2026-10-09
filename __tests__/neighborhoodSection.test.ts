import fs from "fs";
import path from "path";
import {
  HOME_NEARBY_LIMIT,
  type NeighborhoodCardItem,
  type NeighborhoodListScope,
  type NeighborhoodRegion,
  type NeighborhoodSectionState,
  neighborhoodCardCaption,
  neighborhoodNoneCopy,
  neighborhoodSubtitle,
  resolveNeighborhoodSection,
} from "../libs/shared/neighborhoodSection";

/** 앱 scripts/fixtures/neighborhood-section-cases.json 과 같은 파일이다(앱은 node --test 로 같은 케이스를 돈다). */
const cases = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/neighborhood-section-cases.json"), "utf8")
) as {
  resolve: {
    name: string;
    input: Omit<Parameters<typeof resolveNeighborhoodSection>[0], "data"> & {
      data: Parameters<typeof resolveNeighborhoodSection>[0]["data"] | null;
    };
    expect: NeighborhoodSectionState;
  }[];
  subtitle: { name: string; state: NeighborhoodSectionState; expect: string | null }[];
  caption: { name: string; item: NeighborhoodCardItem; scope: NeighborhoodListScope; expect: string }[];
  noneCopy: {
    name: string;
    region: NeighborhoodRegion;
    visible: boolean;
    expect: { title: string; body: string };
  }[];
};

describe("홈 동네 브리더 섹션 — 공유 케이스", () => {
  it.each(cases.resolve)("resolve: $name", ({ input, expect: expected }) => {
    expect(resolveNeighborhoodSection({ ...input, data: input.data ?? undefined })).toEqual(expected);
  });
  it.each(cases.subtitle)("subtitle: $name", ({ state, expect: expected }) => {
    expect(neighborhoodSubtitle(state)).toBe(expected);
  });
  it.each(cases.caption)("caption: $name", ({ item, scope, expect: expected }) => {
    expect(neighborhoodCardCaption(item, scope)).toBe(expected);
  });
  it.each(cases.noneCopy)("noneCopy: $name", ({ region, visible, expect: expected }) => {
    expect(neighborhoodNoneCopy(region, visible)).toEqual(expected);
  });
});

describe("홈 동네 브리더 섹션 — 웹 전용", () => {
  it(`카드는 최대 ${HOME_NEARBY_LIMIT}장`, () => {
    const item = (id: number) => ({
      user: { id, name: `b${id}`, avatar: null },
      region: { sido: "서울특별시", sigungu: "강남구" },
      postsCount: 0,
      commentsCount: 0,
    });
    const state = resolveNeighborhoodSection({
      loggedIn: true,
      region: { sido: "서울특별시", sigungu: "강남구" },
      regionVisible: true,
      data: { scope: "sigungu", region: null, items: Array.from({ length: 14 }, (_, i) => item(i)), total: 14 },
      isError: false,
    });
    expect(state.kind).toBe("filled");
    if (state.kind === "filled") {
      expect(state.items).toHaveLength(HOME_NEARBY_LIMIT);
      expect(state.total).toBe(14);
      // 응답 region 이 없으면 내 동네를 쓴다
      expect(state.region.sigungu).toBe("강남구");
    }
  });
});
