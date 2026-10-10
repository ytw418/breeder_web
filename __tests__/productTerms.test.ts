import { dealTypeLabel, productStatusLabel } from "@libs/shared/productTerms";

/** 앱 src/lib/productTerms.ts 와 같은 규칙(앱은 scripts/test-product-terms.mjs). */

describe("productStatusLabel", () => {
  it("상태 값은 분양 용어로 보인다", () => {
    expect(productStatusLabel("판매중")).toBe("분양중");
    expect(productStatusLabel("예약중")).toBe("예약중");
    expect(productStatusLabel("판매완료")).toBe("분양완료");
  });

  it("모르는 상태는 그대로, 빈 값은 빈 문자열", () => {
    expect(productStatusLabel("숨김")).toBe("숨김");
    expect(productStatusLabel(null)).toBe("");
    expect(productStatusLabel(undefined)).toBe("");
  });
});

describe("dealTypeLabel", () => {
  it("거래 유형은 유료·무료 분양으로 보인다", () => {
    expect(dealTypeLabel("sale")).toBe("유료 분양");
    expect(dealTypeLabel("adoption")).toBe("무료 분양");
    expect(dealTypeLabel("rehoming")).toBe("파양");
  });

  it("거래 유형이 없으면(구 서버) 유료 분양, 모르는 값은 그대로", () => {
    expect(dealTypeLabel(undefined)).toBe("유료 분양");
    expect(dealTypeLabel("")).toBe("유료 분양");
    expect(dealTypeLabel("swap")).toBe("swap");
  });
});
