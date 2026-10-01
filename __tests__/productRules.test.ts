import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MIN_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
  PRODUCT_PHOTOS_MAX,
  PRODUCT_PRICE_MAX,
  PRODUCT_PRICE_MIN,
  validateProductInput,
} from "@libs/productRules";

const valid = {
  name: "왕사슴 유충",
  price: 10000,
  description: "건강한 3령 유충입니다.",
};

describe("productRules", () => {
  it("등록 화면과 같은 기준값을 쓴다", () => {
    expect(PRODUCT_NAME_MIN_LENGTH).toBe(2);
    expect(PRODUCT_NAME_MAX_LENGTH).toBe(60);
    expect(PRODUCT_PRICE_MIN).toBe(100);
    expect(PRODUCT_PRICE_MAX).toBe(1_000_000_000);
    expect(PRODUCT_DESCRIPTION_MIN_LENGTH).toBe(10);
    expect(PRODUCT_DESCRIPTION_MAX_LENGTH).toBe(3000);
  });

  it("정상 입력은 정규화한 값을 돌려준다", () => {
    const result = validateProductInput({ ...valid, name: "  왕사슴 유충  ", price: "10000" });
    expect(result).toEqual({
      ok: true,
      value: { name: "왕사슴 유충", price: 10000, description: valid.description },
    });
  });

  it.each([
    ["가", false],
    ["가나", true],
    ["가".repeat(60), true],
    ["가".repeat(61), false],
    ["  가  ", false],
  ])("상품명 %p → 통과 %p", (name, ok) => {
    const result = validateProductInput({ ...valid, name });
    expect(result.ok).toBe(ok);
    if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_NAME");
  });

  it.each([
    [99, false],
    [100, true],
    [1_000_000_000, true],
    [1_000_000_001, false],
    [100.5, false],
    ["abc", false],
    [null, false],
    ["", false],
  ])("가격 %p → 통과 %p", (price, ok) => {
    const result = validateProductInput({ ...valid, price });
    expect(result.ok).toBe(ok);
    if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_PRICE");
  });

  it.each([
    ["가".repeat(9), false],
    ["가".repeat(10), true],
    ["가".repeat(3000), true],
    ["가".repeat(3001), false],
    [`   ${"가".repeat(9)}   `, false],
  ])("설명 길이 %#", (description, ok) => {
    const result = validateProductInput({ ...valid, description });
    expect(result.ok).toBe(ok);
    if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_DESCRIPTION");
  });

  it("필드가 없으면 거절한다", () => {
    expect(validateProductInput({}).ok).toBe(false);
  });

  it("partial 모드는 보낸 필드만 검사하고 나머지는 결과에서 뺀다", () => {
    expect(validateProductInput({ name: "새 이름" }, { partial: true })).toEqual({
      ok: true,
      value: { name: "새 이름" },
    });
    expect(validateProductInput({ price: 1 }, { partial: true }).ok).toBe(false);
  });

  describe("사진 장수", () => {
    const photos = (n: number) => Array.from({ length: n }, (_, i) => `img-${i + 1}`);

    it("최대 10장", () => {
      expect(PRODUCT_PHOTOS_MAX).toBe(10);
    });

    it.each([
      [0, true],
      [1, true],
      [10, true],
      [11, false],
    ])("%p장 → 통과 %p", (count, ok) => {
      const result = validateProductInput({ ...valid, photos: photos(count) });
      expect(result.ok).toBe(ok);
      if (result.ok) expect(result.value.photos).toEqual(photos(count));
      else expect(result.errorCode).toBe("PRODUCT_TOO_MANY_PHOTOS");
    });

    it("사진을 보내지 않으면 검사하지 않고 결과에서 뺀다", () => {
      const result = validateProductInput(valid);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).not.toHaveProperty("photos");
    });

    it.each([["img-1"], [[1, 2]], [[""]]])("배열이 아니거나 문자열 id 가 아니면 거절 %#", (bad) => {
      const result = validateProductInput({ ...valid, photos: bad });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_PHOTOS");
    });

    it("partial 모드에서도 11장은 거절한다", () => {
      const result = validateProductInput({ photos: photos(11) }, { partial: true });
      expect(result.ok).toBe(false);
    });
  });
});
