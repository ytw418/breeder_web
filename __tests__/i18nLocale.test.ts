import { parseAcceptLanguage, resolveLocale } from "@libs/shared/i18nLocale";

// 앱 bredy_app scripts/test-i18n-locale.mjs 와 같은 케이스(같은 사본 모듈).
const BOTH = ["ko", "en"] as const;

describe("resolveLocale", () => {
  it("계정 → 저장한 선택 → 기기 언어 순서로 고른다", () => {
    expect(resolveLocale({ account: "en", saved: "ko", device: ["ko-KR"], locales: BOTH })).toBe("en");
    expect(resolveLocale({ account: "xx", saved: "en", device: ["ko-KR"], locales: BOTH })).toBe("en");
    expect(resolveLocale({ device: ["en_US"], locales: BOTH })).toBe("en");
  });

  it("지원하지 않는 기기 언어는 영어가 켜져 있으면 영어, 아니면 한국어", () => {
    expect(resolveLocale({ device: ["fr-FR"], locales: BOTH })).toBe("en");
    expect(resolveLocale({ device: ["fr-FR"], locales: ["ko"] })).toBe("ko");
    expect(resolveLocale({ device: [], locales: BOTH })).toBe("ko");
  });

  it("영어를 켜기 전(기본값)에는 영어 기기·계정도 한국어로 연다", () => {
    expect(resolveLocale({ account: "en", device: ["en-US"] })).toBe("ko");
  });
});

describe("parseAcceptLanguage", () => {
  it("q 높은 순으로 읽는다", () => {
    expect(parseAcceptLanguage("fr;q=0.5, en-US, ko;q=0.9, *;q=0.1")).toEqual(["en-US", "ko", "fr"]);
    expect(parseAcceptLanguage("")).toEqual([]);
  });
});
