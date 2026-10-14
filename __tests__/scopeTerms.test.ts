import { isMammalOnlyScope, scopeTermsFor, withBreederWord } from "@libs/shared/scopeTerms";

const pins = (...paths: string[]) => paths.map((path) => ({ path }));

describe("포유류 전용 범위(category-pin §15)", () => {
  it("포유류 하위로만 고정했을 때만 포유류 전용이다", () => {
    expect(isMammalOnlyScope(pins())).toBe(false);
    expect(isMammalOnlyScope(pins("/mammal/"))).toBe(true);
    expect(isMammalOnlyScope(pins("/mammal/dog/", "/mammal/cat/"))).toBe(true);
    expect(isMammalOnlyScope(pins("/mammal/dog/", "/reptile/"))).toBe(false);
  });

  it("포유류 전용이면 '집사'로 부르고 경매를 숨긴다", () => {
    expect(scopeTermsFor(pins("/mammal/cat/"))).toEqual({ mammalOnly: true, breeder: "집사", showAuctions: false });
    expect(scopeTermsFor(pins("/mammal/", "/fish/"))).toEqual({ mammalOnly: false, breeder: "브리더", showAuctions: true });
  });

  it("정적 문구의 '브리더'를 바꾼다", () => {
    expect(withBreederWord("우리 동네 브리더 · 근처 브리더 3명", "집사")).toBe("우리 동네 집사 · 근처 집사 3명");
    expect(withBreederWord("TOP 브리더", "브리더")).toBe("TOP 브리더");
  });
});
