import fs from "fs";
import path from "path";
import {
  HOME_NEARBY_LIMIT,
  type NeighborhoodCardItem,
  type NeighborhoodSectionState,
  neighborhoodCardCaption,
  neighborhoodCardLocation,
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
  caption: { name: string; item: NeighborhoodCardItem; expect: string | null }[];
  location: { name: string; item: NeighborhoodCardItem; expect: string }[];
  noneCopy: {
    name: string;
    regionLabel: string;
    visitors: number;
    expect: { title: string; body: string | null; action: string };
  }[];
};

describe("홈 동네 브리더 섹션 — 공유 케이스", () => {
  it.each(cases.resolve)("resolve: $name", ({ input, expect: expected }) => {
    expect(resolveNeighborhoodSection({ ...input, data: input.data ?? undefined })).toEqual(expected);
  });
  it.each(cases.subtitle)("subtitle: $name", ({ state, expect: expected }) => {
    expect(neighborhoodSubtitle(state)).toBe(expected);
  });
  it.each(cases.caption)("caption: $name", ({ item, expect: expected }) => {
    expect(neighborhoodCardCaption(item)).toBe(expected);
  });
  it.each(cases.location)("location: $name", ({ item, expect: expected }) => {
    expect(neighborhoodCardLocation(item)).toBe(expected);
  });
  it.each(cases.noneCopy)("noneCopy: $name", ({ regionLabel, visitors, expect: expected }) => {
    expect(neighborhoodNoneCopy(regionLabel, visitors)).toEqual(expected);
  });
});

describe("홈 동네 브리더 섹션 — 웹 전용", () => {
  it(`카드는 최대 ${HOME_NEARBY_LIMIT}장, total 은 그대로`, () => {
    const item = (id: number): NeighborhoodCardItem => ({
      id,
      name: `b${id}`,
      topSpecies: null,
      regionSido: "서울특별시",
      regionSigungu: "강남구",
      distanceKm: 3,
      sameRegion: false,
      isFollowing: false,
    });
    const state = resolveNeighborhoodSection({
      loggedIn: true,
      region: { sido: "서울특별시", sigungu: "강남구" },
      regionVisible: true,
      data: {
        scope: "near",
        regionLabel: "서울",
        total: 14,
        greetingCount: 0,
        items: Array.from({ length: 14 }, (_, i) => item(i)),
      },
      isError: false,
    });
    expect(state.kind).toBe("filled");
    if (state.kind === "filled") {
      expect(state.items).toHaveLength(HOME_NEARBY_LIMIT);
      expect(state.total).toBe(14);
    }
  });

  it("어떤 문구도 '없어요'로 끝나지 않는다", () => {
    for (const c of cases.noneCopy) {
      const copy = neighborhoodNoneCopy(c.regionLabel, c.visitors);
      expect(copy.title).not.toMatch(/없어요$/);
      expect(copy.body ?? "").not.toMatch(/없어요$/);
    }
  });
});
