import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

const mockUseUser = jest.fn();
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);
const mockAuthFetch = jest.fn();
jest.mock("@libs/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@libs/client/toast", () => ({ toast: mockToast }));

import { isBlockDependentKey, useBlocks } from "../hooks/useBlocks";

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const swrFetcher = jest.fn();

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), fetcher: swrFetcher, dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUser.mockReturnValue({ user: { id: 1, name: "나" } });
  swrFetcher.mockResolvedValue({
    success: true,
    blocks: [{ id: 9, user: { id: 7, name: "칠", avatar: null }, createdAt: "2026-10-01" }],
    blockedUserIds: [7],
  });
});

describe("useBlocks", () => {
  it("로그인하면 /api/blocks 를 받아 blockedIds 를 만든다", async () => {
    const { result } = renderHook(() => useBlocks(), { wrapper });
    await waitFor(() => expect(result.current.isBlocked(7)).toBe(true));
    expect(swrFetcher).toHaveBeenCalledWith("/api/blocks");
    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.isBlocked(8)).toBe(false);
  });

  it("비로그인이면 요청하지 않고 빈 Set 이다", () => {
    mockUseUser.mockReturnValue({ user: undefined });
    const { result } = renderHook(() => useBlocks(), { wrapper });
    expect(swrFetcher).not.toHaveBeenCalled();
    expect(result.current.blockedIds.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("block 은 POST 후 응답의 blockedUserIds 로 맞추고 토스트를 띄운다", async () => {
    const { result } = renderHook(() => useBlocks(), { wrapper });
    await waitFor(() => expect(result.current.isBlocked(7)).toBe(true));
    mockAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, blocked: true, blockedUserIds: [7, 8] })
    );
    swrFetcher.mockResolvedValue({ success: true, blocks: [], blockedUserIds: [7, 8] });

    let ok = false;
    await act(async () => {
      ok = await result.current.block(8);
    });

    expect(ok).toBe(true);
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/api/blocks",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: 8 }) })
    );
    await waitFor(() => expect(result.current.isBlocked(8)).toBe(true));
    expect(mockToast.success).toHaveBeenCalledWith(
      "차단했어요. 설정 > 차단 관리에서 해제할 수 있어요."
    );
  });

  it("unblock 은 DELETE /api/blocks/[id] 를 부른다", async () => {
    const { result } = renderHook(() => useBlocks(), { wrapper });
    await waitFor(() => expect(result.current.isBlocked(7)).toBe(true));
    mockAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, blocked: false, blockedUserIds: [] })
    );
    swrFetcher.mockResolvedValue({ success: true, blocks: [], blockedUserIds: [] });

    let ok = false;
    await act(async () => {
      ok = await result.current.unblock(7);
    });

    expect(ok).toBe(true);
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/blocks/7", { method: "DELETE" });
    await waitFor(() => expect(result.current.isBlocked(7)).toBe(false));
    expect(mockToast.success).toHaveBeenCalledWith("차단을 해제했어요.");
  });

  it("서버가 거절하면 false 와 서버 문구 토스트", async () => {
    const { result } = renderHook(() => useBlocks(), { wrapper });
    await waitFor(() => expect(result.current.isBlocked(7)).toBe(true));
    mockAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "자기 자신은 차단할 수 없습니다." }, 400)
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.block(1);
    });

    expect(ok).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith("자기 자신은 차단할 수 없습니다.");
  });
});

describe("isBlockDependentKey", () => {
  it.each([
    ["/api/home/feed?scope=public", true],
    ["/api/ranking", true],
    ["/api/rankings/growth", true],
    ["/api/posts?page=1", true],
    ["$inf$/api/products?page=1", true],
    ["/api/chat", true],
    ["/api/users/3", true],
    [["/api/posts", 1], true],
    ["/api/users", false],
    ["/api/notifications/unread-count", false],
    [null, false],
  ])("%p → %p", (key, expected) => {
    expect(isBlockDependentKey(key)).toBe(expected);
  });
});
