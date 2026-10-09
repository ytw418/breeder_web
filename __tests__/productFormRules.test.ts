import { firstProductFormError, validateProductForm } from "@libs/productRules";
import { filterHomeFeedForBlocked } from "@libs/shared/home";
import { resolveProductPhotoIds } from "../app/(web)/products/_components/productPhotos";

const valid = {
  name: "그란디스 유충",
  price: 0,
  description: "열 글자 이상 설명입니다.",
  category: "곤충",
  productType: "생물",
};

describe("validateProductForm", () => {
  it("0원(무료나눔)은 통과", () => {
    expect(validateProductForm(valid)).toEqual({});
  });

  it("비어 있으면 화면 위에서부터 첫 오류", () => {
    const errors = validateProductForm({
      name: "",
      price: null,
      description: "",
      category: "",
      productType: "",
    });
    expect(errors).toEqual({
      name: "제목을 입력해주세요.",
      category: "카테고리를 선택해주세요.",
      productType: "종류를 선택해주세요.",
      price: "가격을 입력해주세요.",
      description: "설명을 입력해주세요.",
    });
    expect(firstProductFormError(errors)).toBe("제목을 입력해주세요.");
  });

  it("길이·가격 상한", () => {
    expect(validateProductForm({ ...valid, name: "가" }).name).toBe("제목은 2자 이상 입력해주세요.");
    expect(validateProductForm({ ...valid, price: 1_000_000_001 }).price).toBe("가격이 너무 큽니다.");
    expect(validateProductForm({ ...valid, description: "짧음" }).description).toBe(
      "설명을 10자 이상 입력해주세요."
    );
  });
});

describe("filterHomeFeedForBlocked", () => {
  const feed = {
    heroBreeder: { user: { id: 1 } },
    topAuctionsByCategory: [{ seller: { id: 1 } }, { seller: { id: 2 } }],
    topBloodlines: [{ creator: { id: 2 } }, { creator: { id: 3 } }],
    trendingPosts: [{ post: { user: { id: 3 } } }, { post: { user: null } }],
    freeGiveawayProducts: [{ user: { id: 1 } }],
  };

  it("차단이 없으면 그대로", () => {
    const result = filterHomeFeedForBlocked(feed, new Set());
    expect(result.heroBlocked).toBe(false);
    expect(result.topAuctionsByCategory).toHaveLength(2);
  });

  it("차단한 사용자의 항목을 빼고 1위 브리더는 비운다", () => {
    const result = filterHomeFeedForBlocked(feed, new Set([1, 3]));
    expect(result.heroBlocked).toBe(true);
    expect(result.heroBreeder).toBeNull();
    expect(result.topAuctionsByCategory).toEqual([{ seller: { id: 2 } }]);
    expect(result.topBloodlines).toEqual([{ creator: { id: 2 } }]);
    expect(result.trendingPosts).toEqual([{ post: { user: null } }]);
    expect(result.freeGiveawayProducts).toEqual([]);
  });
});

describe("resolveProductPhotoIds", () => {
  const file = (name: string) => new File(["x"], name, { type: "image/png" });

  it("올라간 사진은 그대로 두고 새 사진만 올려 화면 순서대로 돌려준다", async () => {
    const uploaded: number[] = [];
    const ids = await resolveProductPhotoIds(
      [
        { key: "a", src: "a", remoteId: "r1" },
        { key: "b", src: "b", file: file("b.png") },
        { key: "c", src: "c", file: file("c.png") },
      ],
      (index) => uploaded.push(index),
      async (f) => `id-${f.name}`
    );
    expect(ids).toEqual(["r1", "id-b.png", "id-c.png"]);
    expect(uploaded.sort()).toEqual([1, 2]);
  });

  it("실패한 사진 번호를 알려 준다", async () => {
    await expect(
      resolveProductPhotoIds(
        [{ key: "b", src: "b", file: file("b.png") }],
        undefined,
        async () => {
          throw new Error("x");
        }
      )
    ).rejects.toThrow("1번째 사진을 올리지 못했어요. 네트워크를 확인하고 다시 시도해주세요.");
  });
});
