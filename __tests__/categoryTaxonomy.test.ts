import {
  getCategoryFilterValues,
  getCategorySearchKeywords,
  findCategoryBranch,
} from "@libs/categoryTaxonomy";

describe("categoryTaxonomy", () => {
  it("대분류 검색 시 하위 카테고리까지 필터 키워드를 확장한다", () => {
    const values = getCategoryFilterValues("파충류");

    expect(values).toContain("파충류");
    expect(values).toContain("레오파드 게코");
    expect(values).toContain("볼파이썬");
  });

  it("검색어가 대분류일 때 연관 키워드를 함께 반환한다", () => {
    const keywords = getCategorySearchKeywords("곤충");

    expect(keywords).toContain("곤충");
    expect(keywords).toContain("장수풍뎅이");
    expect(keywords).toContain("기타곤충");
  });

  it("검색어가 하위분류일 때 부모 카테고리도 함께 반환한다", () => {
    const keywords = getCategorySearchKeywords("타란튤라");

    expect(keywords).toContain("타란튤라");
    expect(keywords).toContain("절지류");
  });

  it("레거시 별칭을 부모 카테고리로 복원한다", () => {
    expect(findCategoryBranch("기타곤충")).toEqual({ parent: "곤충", child: "" });
  });
});
