import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MIN_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
  PRODUCT_PHOTOS_MAX,
  PRODUCT_PRICE_MAX,
  PRODUCT_PRICE_MIN,
  formatProductPrice,
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
    expect(PRODUCT_PRICE_MIN).toBe(0);
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
    [-1, false],
    [0, true],
    ["0", true],
    [1, true],
    [100, true],
    [1_000_000_000, true],
    [1_000_000_001, false],
    [1.5, false],
    [100.5, false],
    ["abc", false],
    [null, false],
    ["", false],
  ])("가격 %p → 통과 %p", (price, ok) => {
    const result = validateProductInput({ ...valid, price });
    expect(result.ok).toBe(ok);
    if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_PRICE");
  });

  it("0원(무료나눔)은 0 으로 저장하고, 범위를 벗어나면 0원~10억원 안내를 준다", () => {
    const free = validateProductInput({ ...valid, price: 0 });
    expect(free.ok && free.value.price).toBe(0);

    const result = validateProductInput({ ...valid, price: -1 });
    expect(result).toEqual({
      ok: false,
      errorCode: "PRODUCT_INVALID_PRICE",
      message: "가격은 0원~10억원 사이의 정수로 입력해주세요.",
    });
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
    expect(validateProductInput({ price: -1 }, { partial: true }).ok).toBe(false);
  });

  describe("카테고리·상품 타입", () => {
    const create = (input: Record<string, unknown>) =>
      validateProductInput(input, { requireCategory: true });
    const full = { ...valid, category: "구피", productType: "생물" };

    it.each([["어류"], ["구피"], ["밀웜/귀뚜라미"], ["기타곤충"], ["나비/나방"]])(
      "대분류·하위분류·레거시 별칭 %p 은 통과하고 그대로 저장한다",
      (category) => {
        const result = create({ ...full, category });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.category).toBe(category);
      }
    );

    it("앞뒤 공백은 지우고 저장한다", () => {
      const result = create({ ...full, category: "  구피 ", productType: " 용품 " });
      expect(result.ok && result.value).toMatchObject({ category: "구피", productType: "용품" });
    });

    it.each([["강아지"], [""], ["전체"], [3], [null], [undefined]])(
      "알 수 없는 카테고리 %p 는 거절한다",
      (category) => {
        const result = create({ ...full, category });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_CATEGORY");
      }
    );

    it.each([["기타"], [""], [1], [null], [undefined]])(
      "생물·용품이 아닌 상품 타입 %p 는 거절한다",
      (productType) => {
        const result = create({ ...full, productType });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errorCode).toBe("PRODUCT_INVALID_PRODUCT_TYPE");
      }
    );

    it("partial 모드는 생략을 허용하고 결과에서 뺀다", () => {
      const result = validateProductInput({ name: "새 이름" }, { partial: true });
      expect(result).toEqual({ ok: true, value: { name: "새 이름" } });
    });

    it("partial 모드도 보낸 값은 검사한다", () => {
      const category = validateProductInput({ category: "강아지" }, { partial: true });
      expect(!category.ok && category.errorCode).toBe("PRODUCT_INVALID_CATEGORY");

      const productType = validateProductInput({ productType: "기타" }, { partial: true });
      expect(!productType.ok && productType.errorCode).toBe("PRODUCT_INVALID_PRODUCT_TYPE");

      expect(
        validateProductInput({ category: "어류", productType: "용품" }, { partial: true })
      ).toEqual({ ok: true, value: { category: "어류", productType: "용품" } });
    });

    it("requireCategory 없이 부르면(웹 수정 화면 사전 검사) 생략을 허용한다", () => {
      expect(validateProductInput(valid).ok).toBe(true);
      const bad = validateProductInput({ ...valid, category: "강아지" });
      expect(!bad.ok && bad.errorCode).toBe("PRODUCT_INVALID_CATEGORY");
    });
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

describe("formatProductPrice", () => {
  it("0원은 무료나눔으로 보인다", () => {
    expect(formatProductPrice(0)).toBe("무료나눔");
  });

  it.each([[null], [undefined]])("가격이 없으면(%p) 가격 미정", (price) => {
    expect(formatProductPrice(price)).toBe("가격 미정");
  });

  it("가격이 있으면 원 단위로 보인다", () => {
    expect(formatProductPrice(1234)).toBe("1,234원");
  });
});
