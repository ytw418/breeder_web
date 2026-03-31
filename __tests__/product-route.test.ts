import {
  extractProductId,
  getProductPath,
} from "@libs/product-route";

describe("product-route", () => {
  it("영문 제목은 slug 경로를 유지해야 함", () => {
    expect(getProductPath(15, "Top Beetle Larva")).toBe(
      "/products/15_Top-Beetle-Larva"
    );
  });

  it("한글 제목도 slug 경로를 유지해야 함", () => {
    expect(getProductPath(15, "톱사슴벌레 유충")).toBe(
      "/products/15_톱사슴벌레-유충"
    );
  });

  it("기존 상세 경로에서 상품 id를 안정적으로 추출해야 함", () => {
    expect(extractProductId("15_top-beetle-larva")).toBe("15");
    expect(extractProductId("15_톱사슴벌레-유충")).toBe("15");
    expect(extractProductId("15")).toBe("15");
  });
});
