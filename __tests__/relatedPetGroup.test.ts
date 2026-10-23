import { petRegionColumns, relatedPetGroupWhere } from "@libs/server/petInfo";

/** 상세 '비슷한 분양'은 강아지·고양이 글과 다른 종 글을 섞지 않는다(앱 docs/prd/pet-space.md §5.8). */
describe("relatedPetGroupWhere", () => {
  it("강아지·고양이 글이면 강아지·고양이 글만 찾는다", () => {
    expect(relatedPetGroupWhere("강아지")).toEqual({ category: { in: ["강아지", "고양이"] } });
    expect(relatedPetGroupWhere("고양이")).toEqual({ category: { in: ["강아지", "고양이"] } });
  });

  it("다른 종 글이면 강아지·고양이 글을 빼고, 카테고리가 없는 옛 글은 남긴다", () => {
    const where = { OR: [{ category: null }, { category: { notIn: ["강아지", "고양이"] } }] };
    expect(relatedPetGroupWhere("레오파드 게코")).toEqual(where);
    expect(relatedPetGroupWhere("햄스터")).toEqual(where);
    expect(relatedPetGroupWhere(null)).toEqual(where);
  });
});

/** 가족 찾아요·임보 구해요 글 동네(앱 docs/prd/pet-space.md §5.9). */
describe("petRegionColumns", () => {
  const author = { regionSido: "서울특별시", regionSigungu: "마포구" };
  const foster = { category: "고양이", dealType: "foster" };
  const cleared = { regionSido: null, regionSigungu: null };

  it("켰고 강아지·고양이 가족 찾아요·임보 구해요 글이면 작성자 동네를 복사한다", () => {
    expect(petRegionColumns(true, foster, author)).toEqual(author);
    expect(petRegionColumns(true, { category: "강아지", dealType: "rehoming" }, author)).toEqual(author);
  });

  it("보내지 않았으면 손대지 않는다(옛 앱·다른 칸만 고친 수정)", () => {
    expect(petRegionColumns(undefined, foster, author)).toBeUndefined();
  });

  it("껐거나 분양해요·다른 종 글이거나 작성자 동네가 없으면 지운다", () => {
    expect(petRegionColumns(false, foster, author)).toEqual(cleared);
    expect(petRegionColumns(true, { category: "고양이", dealType: "adoption" }, author)).toEqual(cleared);
    expect(petRegionColumns(true, { category: "레오파드게코", dealType: "sale" }, author)).toEqual(cleared);
    expect(petRegionColumns(true, foster, { regionSido: "서울특별시", regionSigungu: null })).toEqual(cleared);
    expect(petRegionColumns(true, foster, null)).toEqual(cleared);
  });
});
