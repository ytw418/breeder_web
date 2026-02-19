import {
  normalizeOptionalText,
  normalizeOptionalUrl,
} from "@libs/shared/normalize";

describe("normalizeOptionalText", () => {
  it("문자열이 아닌 값은 null을 반환해야 함", () => {
    expect(normalizeOptionalText(undefined)).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
    expect(normalizeOptionalText(123)).toBeNull();
    expect(normalizeOptionalText(true)).toBeNull();
    expect(normalizeOptionalText({})).toBeNull();
  });

  it("빈 문자열은 null을 반환해야 함", () => {
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(normalizeOptionalText("\t\n")).toBeNull();
  });

  it("앞뒤 공백을 제거해야 함", () => {
    expect(normalizeOptionalText("  hello  ")).toBe("hello");
    expect(normalizeOptionalText("\thello\n")).toBe("hello");
  });

  it("기본 최대 길이(120자)를 초과하면 잘라야 함", () => {
    const longText = "a".repeat(200);
    const result = normalizeOptionalText(longText);
    expect(result).toHaveLength(120);
  });

  it("커스텀 최대 길이를 적용해야 함", () => {
    const result = normalizeOptionalText("hello world", 5);
    expect(result).toBe("hello");
  });

  it("최대 길이 이하의 문자열은 그대로 반환해야 함", () => {
    expect(normalizeOptionalText("hello", 10)).toBe("hello");
  });
});

describe("normalizeOptionalUrl", () => {
  it("문자열이 아닌 값은 null을 반환해야 함", () => {
    expect(normalizeOptionalUrl(undefined)).toBeNull();
    expect(normalizeOptionalUrl(null)).toBeNull();
  });

  it("빈 문자열은 null을 반환해야 함", () => {
    expect(normalizeOptionalUrl("")).toBeNull();
    expect(normalizeOptionalUrl("   ")).toBeNull();
  });

  it("http:// 프로토콜이 있으면 그대로 반환해야 함", () => {
    expect(normalizeOptionalUrl("http://example.com")).toBe("http://example.com");
  });

  it("https:// 프로토콜이 있으면 그대로 반환해야 함", () => {
    expect(normalizeOptionalUrl("https://example.com")).toBe("https://example.com");
  });

  it("프로토콜이 없으면 https://를 추가해야 함", () => {
    expect(normalizeOptionalUrl("example.com")).toBe("https://example.com");
    expect(normalizeOptionalUrl("www.example.com")).toBe("https://www.example.com");
  });

  it("최대 300자 제한을 적용해야 함", () => {
    const longUrl = "https://" + "a".repeat(400);
    const result = normalizeOptionalUrl(longUrl);
    expect(result!.length).toBeLessThanOrEqual(300);
  });
});
