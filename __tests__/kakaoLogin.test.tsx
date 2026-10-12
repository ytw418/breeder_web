/**
 * 카카오 로그인 처리 화면(/login-loading). 인가 코드 교환이 실패하면 스피너에 멈추지 않는다.
 * 2026-10-11 제보 '지역 설정 후 무한 로딩': 로그인 직후 뒤로 가기로 이 화면에 다시 오면 이미 쓴 코드라
 * 카카오가 invalid_grant 를 돌려주는데, 이전에는 그대로 스피너만 돌았다.
 */
import { render, waitFor } from "@testing-library/react";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockKakaoAuth = jest.fn();
const mockLogin = jest.fn();
let mockTokenData: unknown;
const mockHasTokens = jest.fn();
const mockToastError = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams("code=USED&state=%2Fsettings%2Fregion"),
}));
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock(
  "hooks/useMutation",
  () => ({
    __esModule: true,
    default: (url: string) =>
      url === "https://kauth.kakao.com" ? [mockKakaoAuth, { data: mockTokenData }] : [mockLogin, {}],
  }),
  { virtual: true }
);
jest.mock("@libs/client/authToken", () => ({ setTokens: jest.fn(), hasTokens: () => mockHasTokens() }));
jest.mock("@libs/client/toast", () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args) } }));
jest.mock("@libs/client/postLogin", () => ({
  getSafeNextPath: (path: string | null) => path || "/",
  navigateAfterSessionReady: jest.fn(),
}));
jest.mock("@libs/client/accountRestriction", () => ({
  ACCOUNT_RESTRICTED_LOGIN_PATH: "/auth/login?restricted=1",
  saveAccountRestriction: jest.fn(),
  toAccountRestriction: () => null,
}));
jest.mock("@components/atoms/Spinner", () => ({ Spinner: () => <span>spinner</span> }));

import KakaoLogin from "@components/auth/KakaoLogin";

beforeEach(() => {
  jest.clearAllMocks();
  mockTokenData = undefined;
});

describe("카카오 로그인 처리 화면", () => {
  it("코드가 있으면 토큰을 받는다", () => {
    render(<KakaoLogin />);
    expect(mockKakaoAuth).toHaveBeenCalledTimes(1);
  });

  it("이미 로그인돼 있는데 코드 교환이 실패하면(뒤로 가기로 다시 온 경우) 홈으로 바꾼다", async () => {
    mockHasTokens.mockReturnValue(true);
    mockTokenData = { error: "invalid_grant" };
    render(<KakaoLogin />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("로그인 전인데 코드 교환이 실패하면 안내하고 로그인 화면으로 바꾼다", async () => {
    mockHasTokens.mockReturnValue(false);
    mockTokenData = { error: "invalid_grant" };
    render(<KakaoLogin />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/auth/login"));
    expect(mockToastError).toHaveBeenCalledWith("카카오 로그인에 실패했어요. 다시 시도해 주세요");
  });
});
