import {
  formatAmountInput,
  formatProductPrice,
  parseAmount,
  toAmountDigits,
} from "@libs/shared/price";

describe("가격 입력 유틸", () => {
  it("toAmountDigits 는 숫자만 남기고 앞자리 0을 뗀다", () => {
    expect(toAmountDigits("01,000")).toBe("1000");
    expect(toAmountDigits("1,2a3원")).toBe("123");
    expect(toAmountDigits("000")).toBe("0");
    expect(toAmountDigits("")).toBe("");
  });

  it("formatAmountInput 은 세 자리마다 콤마를 넣는다", () => {
    expect(formatAmountInput("1234567")).toBe("1,234,567");
    expect(formatAmountInput("999")).toBe("999");
    expect(formatAmountInput("0")).toBe("0");
    expect(formatAmountInput("")).toBe("");
  });

  it("parseAmount 는 콤마 문자열을 숫자로, 빈 값은 null 로 바꾼다", () => {
    expect(parseAmount("1,000")).toBe(1000);
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("formatProductPrice: 0 → 무료나눔, 없음 → 가격 미정, 그 외 원", () => {
    expect(formatProductPrice(0)).toBe("무료나눔");
    expect(formatProductPrice(null)).toBe("가격 미정");
    expect(formatProductPrice(undefined)).toBe("가격 미정");
    expect(formatProductPrice(12000)).toBe("12,000원");
  });
});
