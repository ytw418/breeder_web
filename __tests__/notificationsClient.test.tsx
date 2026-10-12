import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const mockAuthFetch = jest.fn();
jest.mock("@libs/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));
jest.mock("@libs/client/toast", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/notifications",
}));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));

import NotificationsClient from "../app/(web)/notifications/NotificationsClient";

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const HOUR = 3600_000;
const sender = (id: number, name: string) => ({ id, name, avatar: null });

const listResponse = {
  success: true,
  unreadCount: 2,
  notifications: [
    { id: 11, type: "BID", message: "젠크레님이 \"크레\" 경매에 150,000원을 입찰했습니다.", isRead: false, targetId: 50, targetType: "auction", commentId: null, createdAt: iso(3 * 60_000), sender: sender(5, "젠크레"), targetImage: "img-a" },
    { id: 12, type: "FOLLOW", message: "하늘사슴벌레님이 회원님을 팔로우했습니다.", isRead: false, targetId: 6, targetType: "user", commentId: null, createdAt: iso(60_000), sender: sender(6, "하늘사슴벌레"), targetImage: null },
    { id: 13, type: "AUCTION_WON", message: "\"핀스트라이프\" 경매에 낙찰되었습니다.", isRead: true, targetId: 51, targetType: "auction", commentId: null, createdAt: iso(10 * 24 * HOUR), sender: sender(1, "관리자"), targetImage: null },
  ],
};

function renderScreen() {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: async (key: string) =>
          key === "/api/notifications/unread-count" ? { success: true, unreadCount: 2 } : listResponse,
      }}
    >
      <NotificationsClient />
    </SWRConfig>
  );
}

const postBodies = () =>
  mockAuthFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

beforeEach(() => {
  mockAuthFetch.mockReset();
  mockAuthFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, unreadCount: 0, notifications: [] }) });
  mockPush.mockReset();
});

describe("알림 목록(웹)", () => {
  it("화면에 들어와도 읽음 처리 요청을 보내지 않는다(2026-10-11 버그)", async () => {
    renderScreen();
    expect((await screen.findAllByText(/회원님을 팔로우했습니다/)).length).toBeGreaterThan(0);
    // SWR 가 데이터를 받은 뒤 effect 가 돌 시간을 준다.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(postBodies()).toEqual([]);
    expect(screen.getByText("2개")).toBeInTheDocument();
  });

  it("오늘·이전 알림으로 묶고, 보낸 사람 이름을 굵게 보인다", async () => {
    renderScreen();
    expect(await screen.findByRole("heading", { name: "오늘" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이전 알림" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "최근 7일" })).toBeNull();
    expect(screen.getByText("젠크레").tagName).toBe("B");
    expect(screen.getByText(/입찰 · 3분 전/)).toBeInTheDocument();
  });

  it("누른 알림 하나만 읽음 처리하고 대상으로 간다", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /하늘사슴벌레님이 회원님을 팔로우했습니다/ }));
    await waitFor(() => expect(postBodies()).toEqual([{ id: 12 }]));
    expect(mockPush).toHaveBeenCalledWith("/profiles/6");
    expect(screen.getByText("1개")).toBeInTheDocument();
  });

  it("이미 읽은 알림은 요청 없이 이동만 한다", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /핀스트라이프/ }));
    expect(mockPush).toHaveBeenCalledWith("/auctions/51");
    expect(postBodies()).toEqual([]);
  });

  it("'모두 읽음'을 누르면 전체 읽음 요청을 보낸다", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "모두 읽음" }));
    await waitFor(() => expect(postBodies()).toEqual([{}]));
    await waitFor(() => expect(screen.queryByText("안 읽은 알림")).toBeNull());
  });
});
