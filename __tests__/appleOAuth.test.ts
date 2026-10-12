/**
 * @jest-environment node
 */
import { createHash } from "crypto";

import {
  buildAppleAppReturnUrl,
  buildAppleAuthorizeUrl,
  buildAppleWebErrorUrl,
  createAppleNonce,
  getAppleOAuthConfig,
  hashAppleNonce,
  peekAppleStateTarget,
  renderAppleWebReturnPage,
  sanitizeAppleNextPath,
  signAppleState,
  verifyAppleState,
} from "@libs/server/appleOAuth";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, COOKIE_PASSWORD: "test-cookie-password" };
  delete process.env.APPLE_STATE_SECRET;
  delete process.env.APPLE_SERVICES_ID;
  delete process.env.APPLE_REDIRECT_URI;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const NOW = 1_800_000_000_000;

describe("state 서명", () => {
  it("서명한 state 를 그대로 풀어낸다", () => {
    const state = signAppleState({ t: "app", n: "/posts/3", h: "abc", exp: NOW / 1000 + 600 });
    expect(verifyAppleState(state, NOW)).toEqual({
      t: "app",
      n: "/posts/3",
      h: "abc",
      exp: NOW / 1000 + 600,
    });
  });

  it("내용을 바꾼 state 는 거부한다", () => {
    const state = signAppleState({ t: "web", n: "/", h: "abc", exp: NOW / 1000 + 600 });
    const [, sig] = state.split(".");
    const forged = Buffer.from(
      JSON.stringify({ t: "app", n: "/", h: "abc", exp: NOW / 1000 + 600 })
    ).toString("base64url");
    expect(verifyAppleState(`${forged}.${sig}`, NOW)).toBeNull();
  });

  it("만료된 state 는 거부한다", () => {
    const state = signAppleState({ t: "web", n: "/", h: "abc", exp: NOW / 1000 - 1 });
    expect(verifyAppleState(state, NOW)).toBeNull();
  });

  it("다른 시크릿으로 서명한 state 는 거부한다", () => {
    const state = signAppleState({ t: "web", n: "/", h: "abc", exp: NOW / 1000 + 600 });
    process.env.APPLE_STATE_SECRET = "other-secret";
    expect(verifyAppleState(state, NOW)).toBeNull();
  });

  it("모양이 틀린 값은 거부한다", () => {
    expect(verifyAppleState(undefined, NOW)).toBeNull();
    expect(verifyAppleState("", NOW)).toBeNull();
    expect(verifyAppleState("abc", NOW)).toBeNull();
    expect(verifyAppleState(["a.b"], NOW)).toBeNull();
  });

  it("서명이 틀려도 목적지(web/app)만은 읽어 오류 안내 경로를 고를 수 있다", () => {
    const body = Buffer.from(JSON.stringify({ t: "app", n: "/", h: "x", exp: 1 })).toString(
      "base64url"
    );
    expect(peekAppleStateTarget(`${body}.bad`)).toBe("app");
    expect(peekAppleStateTarget("garbage")).toBeNull();
    const evil = Buffer.from(JSON.stringify({ t: "https://evil.example" })).toString("base64url");
    expect(peekAppleStateTarget(`${evil}.x`)).toBeNull();
  });
});

describe("nonce", () => {
  it("원래 nonce 는 매번 다르고, 해시는 sha256 hex 다", () => {
    const a = createAppleNonce();
    const b = createAppleNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(hashAppleNonce(a)).toBe(createHash("sha256").update(a).digest("hex"));
  });
});

describe("다음 경로", () => {
  it("같은 사이트 경로만 남긴다", () => {
    expect(sanitizeAppleNextPath("/posts/3?x=1")).toBe("/posts/3?x=1");
    expect(sanitizeAppleNextPath("%2Fposts%2F3")).toBe("/posts/3");
    expect(sanitizeAppleNextPath("//evil.example")).toBe("/");
    expect(sanitizeAppleNextPath("https://evil.example")).toBe("/");
    expect(sanitizeAppleNextPath(undefined)).toBe("/");
    expect(sanitizeAppleNextPath(["/a", "/b"])).toBe("/");
  });
});

describe("설정", () => {
  it("Services ID 와 Return URL 이 둘 다 있어야 설정이 있다", () => {
    expect(getAppleOAuthConfig()).toBeNull();
    process.env.APPLE_SERVICES_ID = "app.bredy.web";
    expect(getAppleOAuthConfig()).toBeNull();
    process.env.APPLE_REDIRECT_URI = "https://bredy.app/api/auth/apple/callback";
    expect(getAppleOAuthConfig()).toEqual({
      servicesId: "app.bredy.web",
      redirectUri: "https://bredy.app/api/auth/apple/callback",
    });
  });
});

describe("Apple 로그인 주소", () => {
  it("form_post 로 id_token 을 받고 nonce 해시를 싣는다", () => {
    const url = new URL(
      buildAppleAuthorizeUrl({
        servicesId: "app.bredy.web",
        redirectUri: "https://bredy.app/api/auth/apple/callback",
        state: "s.t",
        nonceHash: "h",
      })
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("client_id")).toBe("app.bredy.web");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://bredy.app/api/auth/apple/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code id_token");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("scope")).toBe("name email");
    expect(url.searchParams.get("state")).toBe("s.t");
    expect(url.searchParams.get("nonce")).toBe("h");
  });
});

describe("돌아갈 주소", () => {
  it("앱은 패키지를 지정한 intent 주소로 토큰을 넘긴다", () => {
    expect(buildAppleAppReturnUrl({ idToken: "a.b.c" })).toBe(
      "intent://auth/apple?id_token=a.b.c#Intent;scheme=bredy;package=app.bredy.mobile;end"
    );
  });

  it("앱 오류 주소에는 토큰이 없다", () => {
    const url = buildAppleAppReturnUrl({ error: "apple_cancelled" });
    expect(url).toBe(
      "intent://auth/apple?error=apple_cancelled#Intent;scheme=bredy;package=app.bredy.mobile;end"
    );
    expect(url).not.toContain("id_token");
  });

  it("웹 오류는 로그인 화면으로 보낸다", () => {
    expect(buildAppleWebErrorUrl("apple_state")).toBe("/auth/login?error=apple_state");
  });

  it("웹 복귀 페이지는 토큰을 URL 이 아니라 sessionStorage 로 넘기고 완료 페이지로 옮긴다", () => {
    const html = renderAppleWebReturnPage({ idToken: "a.b.c", next: "/posts/3" });
    expect(html).toContain('sessionStorage.setItem("bredy:apple-return","a.b.c")');
    expect(html).toContain('location.replace("/auth/apple/complete?next=%2Fposts%2F3")');
  });

  it("웹 복귀 페이지는 스크립트를 끊는 문자를 이스케이프한다", () => {
    const html = renderAppleWebReturnPage({ idToken: "</script><script>x", next: "/" });
    expect(html).not.toContain("</script><script>x");
    expect(html).toContain("\\u003c/script>\\u003cscript>x");
  });
});
