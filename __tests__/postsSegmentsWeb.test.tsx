import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";

jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => ({ user: undefined, isLoading: false }) }),
  { virtual: true }
);
jest.mock(
  "hooks/useBlocks",
  () => ({ __esModule: true, default: () => ({ blockedIds: new Set<number>() }) }),
  { virtual: true }
);
jest.mock(
  "hooks/useCategoryScope",
  () => ({
    __esModule: true,
    default: () => ({ categoryPath: undefined, topLevelNames: null }),
    withCategoryPath: (url: string) => url,
  }),
  { virtual: true }
);
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("@libs/client/analytics", () => ({
  ANALYTICS_EVENTS: new Proxy({}, { get: (_target, name) => String(name) }),
  trackEvent: jest.fn(),
}));

import PostsClient from "../app/(web)/posts/PostsClient";

const user = { id: 7, name: "젠크레", avatar: null, breederPrograms: [] };
const basePost = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `글 ${id}`,
  description: "본문",
  image: "",
  images: [],
  category: "자유",
  createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  user,
  _count: { comments: 4, Likes: 0 },
  ...extra,
});

const fetcher = async (url: string) => {
  if (url.includes("hot=realtime")) {
    return {
      success: true,
      posts: [
        basePost(1, {
          title: "가고일 게코도 들이고 싶어지는 요즘",
          lastActivityAt: new Date().toISOString(),
          lastActivityKind: "comment",
          hotScore: 9,
        }),
      ],
    };
  }
  if (url.includes("unanswered=1")) {
    return {
      success: true,
      posts: [basePost(9, { title: "볼파이썬 탈피 주기가 너무 짧은데 정상인가요?", category: "질문", _count: { comments: 0, Likes: 0 } })],
      unansweredCount: 3,
    };
  }
  if (url.startsWith("/api/posts/notices")) return { success: true, posts: [], pages: 0 };
  if (url.startsWith("/api/posts?")) return { success: true, posts: [basePost(2)], pages: 1 };
  if (url.startsWith("/api/rankings/")) return { success: true, items: [] };
  return {};
};

beforeAll(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  });
});

function renderPosts() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher, dedupingInterval: 0 }}>
      <PostsClient />
    </SWRConfig>
  );
}

describe("반려생활 상단(community-vibe §3.5)", () => {
  it("세그먼트는 실시간 TOP 토론 · 답 기다려요 N · 동네 · 랭킹이고 이모지가 없다", async () => {
    renderPosts();
    const tablist = screen.getByRole("tablist", { name: "하이라이트 탭" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.replace(/\d+$/, ""))).toEqual([
      "실시간 TOP 토론",
      "답 기다려요",
      "동네",
      "랭킹",
    ]);
    expect(await screen.findByTestId("unanswered-count")).toHaveTextContent("3");
    for (const tab of tabs) expect(tab.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("실시간 토론 카드 메타는 최근 활동 시각이 먼저('방금 댓글 · 작성자 · 댓글 4')", async () => {
    renderPosts();
    const rail = await screen.findByTestId("realtime-hot-rail");
    expect(rail.textContent).toContain("방금 댓글 · 젠크레 · 댓글 4");
  });

  it("답 기다려요 카드는 질문 제목과 '답하기'(#comment)를 보인다", async () => {
    renderPosts();
    const card = await screen.findByTestId("awaiting-answer-card");
    expect(card.textContent).toContain("볼파이썬 탈피 주기가 너무 짧은데 정상인가요?");
    expect(card.textContent).toContain("3시간째 답이 없어요 · 첫 답변은 소통왕 점수 2배");
    expect(within(card).getByRole("link", { name: "답하기" }).getAttribute("href")).toMatch(/#comment$/);
  });

  it("목록 제목에 개수 배지와 '…으로 노출됩니다' 문구가 없다", async () => {
    renderPosts();
    expect(await screen.findByText("글 2")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "전체 게시글" })).toBeTruthy();
    expect(screen.queryByText(/\d+개$/)).toBeNull();
    expect(screen.queryByText(/노출됩니다/)).toBeNull();
  });
});
