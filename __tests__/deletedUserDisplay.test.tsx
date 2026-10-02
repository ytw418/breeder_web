import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import useSWR from "swr";

const mockAuthFetch = jest.fn();
jest.mock("@libs/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));
jest.mock("@libs/client/posthog", () => ({
  capturePosthogError: jest.fn(),
  capturePosthogEvent: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import {
  DELETED_USER_LABEL,
  normalizeDeletedUserNames,
} from "@libs/shared/deletedUser";
import { fetcher } from "@libs/client/fetcher";
import { fetchBloodlineCardEvents } from "@libs/client/bloodlineCardEvents";
import { VariousProvider } from "@libs/client/VariousProvider";
import useMutation from "../hooks/useMutation";

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeDeletedUserNames", () => {
  it("중첩된 객체·배열의 name 만 표시용 라벨로 바꾼다", () => {
    const createdAt = new Date("2026-10-01T00:00:00.000Z");
    const payload = {
      success: true,
      user: { id: 3, name: "탈퇴한 사용자#3" },
      posts: [
        { id: 1, title: "탈퇴한 사용자#3", user: { name: "탈퇴한 사용자#3", createdAt } },
        { id: 2, user: { name: "브리더" } },
      ],
      members: [[{ name: "탈퇴한 사용자#12" }]],
    };

    const result = normalizeDeletedUserNames(payload);

    expect(result).toBe(payload);
    expect(result.user.name).toBe(DELETED_USER_LABEL);
    expect(result.posts[0].user.name).toBe("탈퇴한 사용자");
    expect(result.posts[0].title).toBe("탈퇴한 사용자#3");
    expect(result.posts[0].user.createdAt).toBe(createdAt);
    expect(result.posts[1].user.name).toBe("브리더");
    expect(result.members[0][0].name).toBe("탈퇴한 사용자");
  });

  it("규칙에 정확히 맞는 이름만 바꾼다", () => {
    const payload = [
      { name: "탈퇴한 사용자#abc" },
      { name: "탈퇴한 사용자#3 " },
      { name: "x탈퇴한 사용자#3" },
      { name: 3 },
    ];
    expect(normalizeDeletedUserNames(payload)).toEqual([
      { name: "탈퇴한 사용자#abc" },
      { name: "탈퇴한 사용자#3 " },
      { name: "x탈퇴한 사용자#3" },
      { name: 3 },
    ]);
  });

  it("null·원시값은 그대로 돌려준다", () => {
    expect(normalizeDeletedUserNames(null)).toBeNull();
    expect(normalizeDeletedUserNames(undefined)).toBeUndefined();
    expect(normalizeDeletedUserNames("탈퇴한 사용자#3")).toBe("탈퇴한 사용자#3");
    expect(normalizeDeletedUserNames(3)).toBe(3);
  });
});

describe("웹 클라이언트 응답 정규화", () => {
  it("libs/client/fetcher 응답의 탈퇴 유저 이름을 바꾼다", async () => {
    mockAuthFetch.mockResolvedValue(jsonResponse({ user: { name: "탈퇴한 사용자#5" } }));
    const data = await fetcher("/api/x", { arg: {} });
    expect(data).toEqual({ user: { name: "탈퇴한 사용자" } });
  });

  it("useMutation 응답의 탈퇴 유저 이름을 바꾼다", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonResponse({ success: true, comment: { user: { name: "탈퇴한 사용자#5" } } })
    );
    const { result } = renderHook(() => useMutation("/api/x"));

    let response: any;
    await act(async () => {
      response = await result.current[0]({ data: {} });
    });

    expect(response.comment.user.name).toBe("탈퇴한 사용자");
  });

  it("SWR 전역 fetcher 응답의 탈퇴 유저 이름을 바꾼다", async () => {
    mockAuthFetch.mockResolvedValue(jsonResponse({ user: { name: "탈퇴한 사용자#5" } }));

    const Probe = () => {
      const { data } = useSWR<{ user: { name: string } }>("/api/users/5");
      return <span>{data?.user.name ?? "loading"}</span>;
    };

    render(
      <VariousProvider>
        <Probe />
      </VariousProvider>
    );

    await waitFor(() => expect(screen.getByText("탈퇴한 사용자")).toBeInTheDocument());
  });

  it("혈통카드 이벤트 이력(직접 fetch)의 actor·from·to 이름을 바꾼다", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonResponse({
        success: true,
        events: [
          {
            id: 1,
            action: "LINE_TRANSFER",
            actorUser: { id: 12, name: "탈퇴한 사용자#12" },
            fromUser: { id: 12, name: "탈퇴한 사용자#12" },
            toUser: { id: 3, name: "브리더" },
            createdAt: "2026-10-01T00:00:00.000Z",
          },
        ],
      })
    );

    const events = await fetchBloodlineCardEvents(5, 12);

    expect(mockAuthFetch).toHaveBeenCalledWith("/api/bloodline-cards/5/events?limit=12");
    expect(events).toHaveLength(1);
    expect(events[0].actorUser?.name).toBe("탈퇴한 사용자");
    expect(events[0].fromUser?.name).toBe("탈퇴한 사용자");
    expect(events[0].toUser?.name).toBe("브리더");
  });

  it("혈통카드 이벤트 이력 실패 응답은 빈 배열", async () => {
    mockAuthFetch.mockResolvedValue(jsonResponse({ success: false, error: "x" }, 404));
    await expect(fetchBloodlineCardEvents(5, 10)).resolves.toEqual([]);
  });
});
