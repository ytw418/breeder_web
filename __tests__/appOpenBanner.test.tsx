import { act, fireEvent, render, screen } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push, back: jest.fn() }),
}));

import AppOpenBanner, { IOS_INSTALL_HINT_MS } from "@components/features/AppOpenBanner";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("'브리디 앱에서 보기' 띠 — iOS '열기'(2026-10-21 검토 반영)", () => {
  it("확인 창이 떠 있어도 /download 로 넘기지 않고, 화면에 남아 있으면 '설치하기' 링크만 보여 준다", () => {
    jest.useFakeTimers();
    Object.defineProperty(window.navigator, "userAgent", { value: IPHONE_SAFARI, configurable: true });
    // jsdom 은 bredy:// 이동을 구현하지 않아 콘솔 오류를 낸다.
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    render(<AppOpenBanner />);
    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    act(() => {
      jest.advanceTimersByTime(IOS_INSTALL_HINT_MS);
    });

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "설치하기" }).getAttribute("href")).toBe("/download");

    consoleError.mockRestore();
    jest.useRealTimers();
  });
});
