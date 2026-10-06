import {
  DEFAULT_PRODUCT_FILTERS,
  hasPriceFilter,
  isDefaultFilters,
  normalizePriceRange,
  parseProductFilterParams,
  priceChipLabel,
  toProductQueryParams,
  toProductsApiUrl,
  uniqueById,
} from "@libs/productFilters";

describe("parseProductFilterParams", () => {
  it("빈 쿼리는 기본 필터", () => {
    expect(parseProductFilterParams({})).toEqual({
      ...DEFAULT_PRODUCT_FILTERS,
      minPrice: undefined,
      maxPrice: undefined,
    });
  });

  it("홈 무료나눔 카드 링크(status=판매중&price=0)", () => {
    const filters = parseProductFilterParams(new URLSearchParams("status=판매중&price=0"));
    expect(filters.onSaleOnly).toBe(true);
    expect(filters.minPrice).toBe(0);
    expect(filters.maxPrice).toBe(0);
    expect(priceChipLabel(filters)).toBe("무료나눔");
  });

  it("하위분류·레거시 별칭을 대분류/하위분류로 나눈다", () => {
    expect(parseProductFilterParams({ category: "구피" })).toMatchObject({
      category: "어류",
      subcategory: "구피",
    });
    expect(parseProductFilterParams({ category: "기타곤충" })).toMatchObject({
      category: "곤충",
      subcategory: "",
    });
    expect(parseProductFilterParams({ category: "모름" }).category).toBe("전체");
  });

  it("모르는 정렬·타입은 기본값, 잘못된 가격은 버리고 큰 값은 10억으로 자른다", () => {
    const filters = parseProductFilterParams({
      sort: "cheap",
      productType: "기타",
      minPrice: "-1",
      maxPrice: "99999999999",
    });
    expect(filters.sort).toBe("latest");
    expect(filters.productType).toBe("");
    expect(filters.minPrice).toBeUndefined();
    expect(filters.maxPrice).toBe(1_000_000_000);
  });

  it("배열 값은 첫 값을 쓴다", () => {
    expect(parseProductFilterParams({ sort: ["priceAsc", "popular"] }).sort).toBe("priceAsc");
  });
});

describe("toProductQueryParams / toProductsApiUrl", () => {
  it("하위분류가 있으면 하위분류로 조회하고 무료나눔은 price=0", () => {
    const query = toProductQueryParams({
      ...DEFAULT_PRODUCT_FILTERS,
      category: "어류",
      subcategory: "구피",
      onSaleOnly: true,
      minPrice: 0,
      maxPrice: 0,
    });
    expect(query).toEqual({
      category: "구피",
      productType: undefined,
      status: "판매중",
      sort: "latest",
      price: 0,
    });
  });

  it("URL 에 빈 값은 넣지 않는다", () => {
    const url = toProductsApiUrl(
      { ...DEFAULT_PRODUCT_FILTERS, sort: "priceDesc", minPrice: 10_000 },
      { page: 2, size: 12 }
    );
    expect(url).toBe("/api/products?page=2&size=12&sort=priceDesc&minPrice=10000");
  });
});

describe("priceChipLabel", () => {
  it.each([
    [{}, "가격"],
    [{ maxPrice: 10_000 }, "1만원 이하"],
    [{ minPrice: 100_000 }, "10만원 이상"],
    [{ minPrice: 3_000 }, "3,000원 이상"],
    [{ maxPrice: 7_000 }, "7,000원 이하"],
    [{ minPrice: 5_000, maxPrice: 5_000 }, "5,000원"],
    [{ minPrice: 2_000, maxPrice: 8_000 }, "2,000~8,000원"],
  ])("%j → %s", (range, label) => {
    expect(priceChipLabel(range)).toBe(label);
  });
});

describe("필터 상태 도우미", () => {
  it("기본 필터 판정과 가격 필터 여부", () => {
    expect(isDefaultFilters(DEFAULT_PRODUCT_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_PRODUCT_FILTERS, sort: "popular" })).toBe(false);
    expect(hasPriceFilter({ ...DEFAULT_PRODUCT_FILTERS, maxPrice: 0 })).toBe(true);
  });

  it("최소가 최대보다 크면 바꾼다", () => {
    expect(normalizePriceRange(50_000, 10_000)).toEqual({ minPrice: 10_000, maxPrice: 50_000 });
    expect(normalizePriceRange(null, 3)).toEqual({ minPrice: undefined, maxPrice: 3 });
  });

  it("uniqueById 는 처음 항목만 남긴다", () => {
    expect(uniqueById([{ id: 1, n: "a" }, { id: 2, n: "b" }, { id: 1, n: "c" }])).toEqual([
      { id: 1, n: "a" },
      { id: 2, n: "b" },
    ]);
  });
});
