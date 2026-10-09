import {
  BIO_MAX,
  PROFILE_LINK_MAX,
  normalizeProfileBanner,
  normalizeProfileLink,
  profileLinkLabel,
} from "../libs/shared/profile";

describe("BIO_MAX (프로필 v5)", () => {
  it("소개는 300자까지다", () => {
    expect(BIO_MAX).toBe(300);
  });
});

describe("normalizeProfileLink (대표 링크)", () => {
  it("null·빈 값은 지우기(null)", () => {
    expect(normalizeProfileLink(null)).toEqual({ ok: true, link: null });
    expect(normalizeProfileLink(undefined)).toEqual({ ok: true, link: null });
    expect(normalizeProfileLink("   ")).toEqual({ ok: true, link: null });
  });

  it("http/https 주소는 앞뒤 공백만 지우고 그대로 둔다", () => {
    expect(normalizeProfileLink(" https://blog.naver.com/bredy ")).toEqual({
      ok: true,
      link: "https://blog.naver.com/bredy",
    });
    expect(normalizeProfileLink("http://example.com/a?b=1")).toEqual({
      ok: true,
      link: "http://example.com/a?b=1",
    });
  });

  it("스킴이 없으면 https:// 를 붙인다", () => {
    expect(normalizeProfileLink("youtube.com/@bredy")).toEqual({
      ok: true,
      link: "https://youtube.com/@bredy",
    });
  });

  it("http/https 가 아닌 스킴은 거부한다", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,hi",
      "ftp://example.com",
      "intent://x#Intent;end",
    ]) {
      const result = normalizeProfileLink(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errorCode).toBe("LINK_INVALID");
    }
  });

  it("도메인이 아니거나 공백·자격 증명이 있으면 거부한다", () => {
    for (const bad of [
      "https://localhost",
      "hello world",
      "https://exa mple.com",
      "https://user:pw@example.com",
      "https://",
    ]) {
      expect(normalizeProfileLink(bad).ok).toBe(false);
    }
  });

  it("한글 키보드로 친 자모 주소는 거부하고 한글 도메인은 받는다", () => {
    expect(normalizeProfileLink("ㅆㅐㅕ셔ㅠㄷ.채ㅡ/@ㄱㄷ요").ok).toBe(false);
    expect(normalizeProfileLink("https://ㅠㅣㅐㅎ.ㅜㅁㅍㄷㄱ.채ㅡ").ok).toBe(false);
    expect(normalizeProfileLink("한글.com/ㅋㅋ")).toEqual({ ok: true, link: "https://한글.com/ㅋㅋ" });
  });

  it("문자열이 아니면 LINK_INVALID", () => {
    const result = normalizeProfileLink(123);
    expect(result).toMatchObject({ ok: false, errorCode: "LINK_INVALID" });
  });

  it(`${PROFILE_LINK_MAX}자를 넘으면 LINK_TOO_LONG`, () => {
    const base = "https://example.com/";
    const ok = base + "a".repeat(PROFILE_LINK_MAX - base.length);
    expect(normalizeProfileLink(ok)).toEqual({ ok: true, link: ok });
    expect(normalizeProfileLink(ok + "a")).toMatchObject({
      ok: false,
      errorCode: "LINK_TOO_LONG",
    });
  });
});

describe("profileLinkLabel (링크 표시 문구)", () => {
  it("스킴·www·끝 슬래시를 빼고 보여 준다", () => {
    expect(profileLinkLabel("https://www.youtube.com/@bredy/")).toBe("youtube.com/@bredy");
    expect(profileLinkLabel("https://blog.naver.com/bredy")).toBe("blog.naver.com/bredy");
    expect(profileLinkLabel("http://example.com")).toBe("example.com");
  });

  it("40자를 넘으면 말줄임표로 줄인다", () => {
    const label = profileLinkLabel(`https://example.com/${"a".repeat(80)}`);
    expect(Array.from(label).length).toBe(40);
    expect(label.endsWith("…")).toBe(true);
  });
});

describe("normalizeProfileBanner (커버 이미지 id)", () => {
  it("null·빈 값은 지우기, 문자열 id 는 그대로", () => {
    expect(normalizeProfileBanner(null)).toEqual({ ok: true, banner: null });
    expect(normalizeProfileBanner("")).toEqual({ ok: true, banner: null });
    expect(normalizeProfileBanner("abc-123_DEF")).toEqual({
      ok: true,
      banner: "abc-123_DEF",
    });
  });

  it("id 형식이 아니면 거부한다", () => {
    expect(normalizeProfileBanner(1).ok).toBe(false);
    expect(normalizeProfileBanner("../etc/passwd").ok).toBe(false);
    expect(normalizeProfileBanner("https://evil.com/x.png").ok).toBe(false);
    expect(normalizeProfileBanner("a".repeat(101)).ok).toBe(false);
  });
});
