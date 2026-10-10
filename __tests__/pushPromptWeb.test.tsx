import { act, fireEvent, render, screen } from "@testing-library/react";

const mockAuthFetch = jest.fn();
jest.mock("@libs/client/authFetch", () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }));
const mockUseUser = jest.fn();
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock("hooks/useUser", () => ({ __esModule: true, default: () => mockUseUser() }), { virtual: true });
const mockPush = jest.fn();
let mockPathname = "/";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => mockPathname,
}));

import PushPermissionPrompt, { isWelcomeExcludedPath } from "@components/features/PushPermissionPrompt";
import {
  PUSH_PROMPT_WELCOME_KEY,
  closePushPrompt,
  promptPushAfterProductUpload,
  promptPushOnWelcome,
  subscribePushPrompt,
  type PushPromptRequest,
} from "@libs/client/pushPrompt";

const VAPID = "B".repeat(87);

function setPushSupport(permission: NotificationPermission | null) {
  const w = window as unknown as Record<string, unknown>;
  if (permission === null) {
    delete w.Notification;
    delete w.PushManager;
    return;
  }
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
  w.Notification = { permission, requestPermission: jest.fn() };
  w.PushManager = function PushManager() {};
}

function serverStatus(status: { configured: boolean; subscribed: boolean }) {
  mockAuthFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, vapidPublicKey: VAPID, ...status }),
  });
}

/** 지금 열린 권유를 하나 받는다. */
function lastRequest() {
  let value: PushPromptRequest | null = null;
  const unsubscribe = subscribePushPrompt((request) => {
    value = request;
  });
  unsubscribe();
  return value as PushPromptRequest | null;
}

beforeEach(() => {
  closePushPrompt();
  window.localStorage.clear();
  mockAuthFetch.mockReset();
  mockPush.mockReset();
  mockPathname = "/";
  mockUseUser.mockReturnValue({ user: { id: 7 } });
});

describe("알림 권유 열기(앱 pushPrompt 와 같은 규칙, 대응표 O-2)", () => {
  it("웹 푸시가 안 되는 브라우저는 묻지 않는다", async () => {
    setPushSupport(null);
    await promptPushOnWelcome();
    expect(lastRequest()).toBeNull();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it("welcome: 이 브라우저에 한 번만, 이미 허용했으면 건너뛴다", async () => {
    setPushSupport("default");
    serverStatus({ configured: true, subscribed: false });
    await promptPushOnWelcome();
    expect(lastRequest()).toMatchObject({ reason: "welcome", permission: "default", status: { configured: true } });
    expect(window.localStorage.getItem(PUSH_PROMPT_WELCOME_KEY)).toBe("1");

    closePushPrompt();
    await promptPushOnWelcome();
    expect(lastRequest()).toBeNull();

    window.localStorage.clear();
    setPushSupport("granted");
    await promptPushOnWelcome();
    expect(lastRequest()).toBeNull();
    expect(window.localStorage.getItem(PUSH_PROMPT_WELCOME_KEY)).toBe("1");
  });

  it("welcome: 서버 푸시가 설정되지 않았으면 묻지도, 본 것으로 적지도 않는다", async () => {
    setPushSupport("default");
    serverStatus({ configured: false, subscribed: false });
    await promptPushOnWelcome();
    expect(lastRequest()).toBeNull();
    expect(window.localStorage.getItem(PUSH_PROMPT_WELCOME_KEY)).toBeNull();
  });

  it("product: 이 브라우저가 이 계정 알림을 받는 중이면 묻지 않고, 아니면 매번 묻는다", async () => {
    jest.useFakeTimers();
    try {
      setPushSupport("granted");
      serverStatus({ configured: true, subscribed: true });
      window.localStorage.setItem("bredy.webPush.token", JSON.stringify({ userId: 7, token: "tok" }));
      await promptPushAfterProductUpload(7);
      expect(lastRequest()).toBeNull();

      // 계정 구독은 켜져 있어도 다른 계정 토큰이면(이 브라우저는 못 받음) 묻는다.
      window.localStorage.setItem("bredy.webPush.token", JSON.stringify({ userId: 3, token: "tok" }));
      const pending = promptPushAfterProductUpload(7);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(700);
      });
      await pending;
      expect(lastRequest()).toMatchObject({ reason: "product", permission: "granted" });
    } finally {
      jest.useRealTimers();
    }
  });

  it("로그인·온보딩 경로에서는 welcome 을 확인하지 않는다", () => {
    expect(isWelcomeExcludedPath("/onboarding")).toBe(true);
    expect(isWelcomeExcludedPath("/auth/login")).toBe(true);
    expect(isWelcomeExcludedPath("/posts")).toBe(false);
    expect(isWelcomeExcludedPath("/authors")).toBe(false);
  });
});

describe("알림 권유 시트", () => {
  it("상품 권유 문구와 '나중에'·'알림 켜기'를 그리고, 나중에는 닫는다", async () => {
    setPushSupport("default");
    serverStatus({ configured: true, subscribed: false });
    render(<PushPermissionPrompt />);
    await act(async () => {
      await promptPushAfterProductUpload(7);
    });
    expect(screen.getByText("분양 문의를 놓치지 않게 알림을 켜 주세요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "알림 켜기" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "나중에" }));
    expect(screen.queryByText("분양 문의를 놓치지 않게 알림을 켜 주세요")).toBeNull();
  });

  it("브라우저에서 차단했으면 경로를 안내하고 설정 화면으로 보낸다", async () => {
    setPushSupport("denied");
    serverStatus({ configured: true, subscribed: false });
    render(<PushPermissionPrompt />);
    await act(async () => {
      await promptPushOnWelcome();
    });
    expect(screen.getByText(/브라우저 설정 > 사이트 권한 > 알림에서 브리디를 허용해 주세요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "설정 보기" }));
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});
