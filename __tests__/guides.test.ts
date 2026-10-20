import { CATEGORY_TREE } from "@libs/categoryTaxonomy";
import { GUIDES } from "@/data/guides";
import { PUBLISHED_GUIDE_SLUGS } from "@/data/guides/manifest";
import {
  groupGuides,
  guideCountsText,
  toGuideSlug,
  validateGuide,
  type SpeciesGuide,
} from "@libs/shared/guides";

const taxonomy = CATEGORY_TREE.map((node) => ({ name: node.name, children: node.children }));
const crested = GUIDES.find((g) => g.slug === "크레스티드-게코") as SpeciesGuide;
const clone = (): SpeciesGuide => JSON.parse(JSON.stringify(crested));

describe("가이드 본문 검사(공개 게이트)", () => {
  it.each(GUIDES.map((g) => [g.slug, g] as const))("%s 는 검사를 통과한다", (_slug, guide) => {
    expect(validateGuide(guide, taxonomy)).toEqual([]);
  });

  it("manifest 는 공개 가이드와 같다", () => {
    const published = Object.fromEntries(
      GUIDES.filter((g) => g.status === "published").map((g) => [g.species, g.slug])
    );
    expect(PUBLISHED_GUIDE_SLUGS).toEqual(published);
  });

  it("출처가 한 곳뿐인 숫자, 모자란 준비물, 신고 확인 누락을 막는다", () => {
    const guide = clone();
    guide.overview[0].sources = ["reptifiles"];
    guide.supplies = guide.supplies.slice(0, 7);
    guide.legal.status = "해당 없음";
    const errors = validateGuide(guide, taxonomy).join("\n");
    expect(errors).toContain("한눈에 '수명': 숫자는 출처 2곳 이상");
    expect(errors).toContain("준비물 7개");
    expect(errors).toContain("지정관리 야생동물 여부");
  });

  it("draft 는 분량을 보지 않고 형식만 본다", () => {
    const guide = clone();
    guide.status = "draft";
    guide.supplies = [];
    expect(validateGuide(guide, taxonomy)).toEqual([]);
    guide.overview[0].sources = ["없는출처"];
    expect(validateGuide(guide, taxonomy).join()).toContain("모르는 출처");
  });
});

describe("가이드 표시 도우미", () => {
  it("slug 는 띄어쓰기를 '-' 로 바꾼다", () => {
    expect(toGuideSlug(" 크레스티드 게코 ")).toBe("크레스티드-게코");
  });

  it("집계 줄은 0 을 빼고, 모두 0 이면 null", () => {
    expect(guideCountsText({ posts: 58, products: 0, auctions: 1, bloodlines: 3 })).toBe("브리디 회원 글 58개 · 경매 1");
    expect(guideCountsText({ posts: 0, products: 0, auctions: 0, bloodlines: 2 })).toBeNull();
  });

  it("분류표 순서로 묶고 빈 분류는 뺀다", () => {
    const grouped = groupGuides([
      { group: "어류" as const, slug: "구피" },
      { group: "곤충" as const, slug: "장수풍뎅이" },
    ]);
    expect(grouped.map((g) => g.group)).toEqual(["곤충", "어류"]);
  });
});
