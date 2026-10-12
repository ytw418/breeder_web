import {
  activeSubcategory,
  categoryQueryValue,
  subcategoryChipOptions,
} from "@libs/shared/subcategoryChips";

/** 앱 scripts/test-subcategory-chips.mjs 와 같은 경우. */
const MAMMALS = ["고슴도치", "햄스터", "기니피그"];

describe("subcategoryChips", () => {
  it("고정이 없으면 소분류를 모두 보인다", () => {
    expect(subcategoryChipOptions("포유류", MAMMALS, [])).toEqual(MAMMALS);
  });

  it("전체·소분류 없는 대분류는 칩이 없다", () => {
    expect(subcategoryChipOptions("전체", [], [])).toEqual([]);
    expect(subcategoryChipOptions("", MAMMALS, [])).toEqual([]);
  });

  it("대분류째 고정하면 모두, 소분류만 고정하면 그 소분류만", () => {
    expect(subcategoryChipOptions("포유류", MAMMALS, ["포유류"])).toEqual(MAMMALS);
    expect(subcategoryChipOptions("포유류", MAMMALS, ["포유류 > 햄스터", "파충류"])).toEqual(["햄스터"]);
  });

  it("고정 라벨이 목록과 안 맞으면 모두 보인다", () => {
    expect(subcategoryChipOptions("포유류", MAMMALS, ["포유류 > 다람쥐"])).toEqual(MAMMALS);
  });

  it("범위 밖 소분류는 전체로 돌리고, 서버 값은 소분류 우선", () => {
    expect(activeSubcategory("구피", MAMMALS)).toBe("");
    expect(activeSubcategory("햄스터", MAMMALS)).toBe("햄스터");
    expect(categoryQueryValue("포유류", "햄스터")).toBe("햄스터");
    expect(categoryQueryValue("포유류", "")).toBe("포유류");
    expect(categoryQueryValue("전체", "")).toBeUndefined();
  });
});
