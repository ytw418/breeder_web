import { relatedPetGroupWhere } from "@libs/server/petInfo";

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
