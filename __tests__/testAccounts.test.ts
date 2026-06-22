import {
  canUseTestAccountSwitcher,
  isProductionLikeEnv,
  isTestAccountUser,
  shouldShowTestLoginForEnv,
} from "@libs/shared/test-accounts";

describe("test account helpers", () => {
  it("운영 환경에서는 기본 로그인 화면의 테스트 로그인 섹션을 숨긴다", () => {
    expect(shouldShowTestLoginForEnv("production")).toBe(false);
    expect(shouldShowTestLoginForEnv("prod")).toBe(false);
    expect(shouldShowTestLoginForEnv("preview")).toBe(true);
    expect(isProductionLikeEnv("development")).toBe(false);
  });

  it("FAKE_USER 또는 test_user 계정을 테스트 계정으로 판단한다", () => {
    expect(isTestAccountUser({ role: "FAKE_USER", provider: "kakao" })).toBe(true);
    expect(isTestAccountUser({ role: "USER", provider: "test_user" })).toBe(true);
    expect(isTestAccountUser({ role: "USER", provider: "kakao" })).toBe(false);
  });

  it("테스트 계정 전환 목록은 FAKE_USER와 관리자에게 노출한다", () => {
    expect(canUseTestAccountSwitcher({ role: "USER", provider: "kakao" }, true)).toBe(true);
    expect(canUseTestAccountSwitcher({ role: "FAKE_USER", provider: "test_user" }, false)).toBe(true);
    expect(canUseTestAccountSwitcher({ role: "USER", provider: "kakao" }, false)).toBe(false);
  });
});
