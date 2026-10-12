import { render, waitFor } from "@testing-library/react";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams("next=%2Fposts%2F3"),
}));

const mockLogin = jest.fn();
jest.mock("@/hooks/useMutation", () => ({
  __esModule: true,
  default: () => [mockLogin, { loading: false }],
}));

const mockSetTokens = jest.fn();
jest.mock("@libs/client/authToken", () => ({
  setTokens: (...args: unknown[]) => mockSetTokens(...args),
}));

const mockNavigate = jest.fn();
jest.mock("@libs/client/postLogin", () => ({
  getSafeNextPath: (value: string | null) => value || "/",
  navigateAfterSessionReady: (...args: unknown[]) => mockNavigate(...args),
}));

jest.mock("@components/atoms/Spinner", () => ({ Spinner: () => null }));

import AppleLogin from "@components/auth/AppleLogin";
import { readAccountRestriction } from "@libs/client/accountRestriction";

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("Apple 로그인 완료(/auth/apple/complete)", () => {
  it("복귀 페이지가 넘긴 토큰과 원래 nonce 로 로그인하고, 둘 다 지운다", async () => {
    window.sessionStorage.setItem("bredy:apple-return", "a.b.c");
    window.sessionStorage.setItem("bredy:apple-nonce", "raw-nonce");
    mockLogin.mockImplementation(({ onCompleted }) =>
      onCompleted({ success: true, accessToken: "acc", refreshToken: "ref" })
    );

    render(<AppleLogin />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/posts/3"));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin.mock.calls[0][0].data).toEqual({
      token: "a.b.c",
      name: "Apple User",
      provider: "apple",
      nonce: "raw-nonce",
    });
    expect(mockSetTokens).toHaveBeenCalledWith({ accessToken: "acc", refreshToken: "ref" });
    expect(window.sessionStorage.getItem("bredy:apple-return")).toBeNull();
    expect(window.sessionStorage.getItem("bredy:apple-nonce")).toBeNull();
  });

  it("토큰이나 nonce 가 없으면(다른 탭·새로고침) 로그인 화면에서 다시 시작하게 한다", async () => {
    window.sessionStorage.setItem("bredy:apple-return", "a.b.c");

    render(<AppleLogin />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/auth/login?error=apple_restart")
    );
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("정지 계정이면 이용 제한 안내로 보낸다", async () => {
    window.sessionStorage.setItem("bredy:apple-return", "a.b.c");
    window.sessionStorage.setItem("bredy:apple-nonce", "raw-nonce");
    mockLogin.mockImplementation(({ onCompleted }) =>
      onCompleted({
        success: false,
        errorCode: "ACCOUNT_BANNED",
        error: "이용이 영구 정지된 계정이에요.",
      })
    );

    render(<AppleLogin />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/auth/login?restricted=1"));
    expect(readAccountRestriction()).toEqual(
      expect.objectContaining({ errorCode: "ACCOUNT_BANNED" })
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
