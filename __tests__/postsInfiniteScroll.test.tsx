import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
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
import NoticePostsClient from "../app/(web)/posts/notices/NoticePostsClient";

/** jsdom 에는 IntersectionObserver 가 없다. 바닥 감시 칸이 보이는 순간을 테스트가 직접 일으킨다. */
const observers = new Set<MockIntersectionObserver>();
class MockIntersectionObserver {
  readonly targets: Element[] = [];
  constructor(readonly callback: IntersectionObserverCallback) {
    observers.add(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    observers.delete(this);
  }
  takeRecords() {
    return [];
  }
}

const showSentinel = () => {
  for (const observer of Array.from(observers)) {
    if (!observers.has(observer)) continue;
    const entries = observer.targets.map(
      (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry
    );
    observer.callback(entries, observer as unknown as IntersectionObserver);
  }
};

const post = (id: number) => ({
  id,
  title: `글 ${id}`,
  description: "본문",
  image: "",
  images: [],
  category: "자유",
  createdAt: "2026-10-09T00:00:00.000Z",
  user: { id: 100 + id, name: `작성자${id}`, avatar: null, breederPrograms: [] },
  _count: { comments: 0, Likes: 0 },
});

/** 목록 API 를 몇 번째 페이지로 몇 번 불렀는지 센다. */
function makeFetcher(listPath: "/api/posts?" | "/api/posts/notices?", totalPages: number) {
  const listRequests: number[] = [];
  const fetcher = async (url: string) => {
    if (url.startsWith(listPath)) {
      const page = Number(new URL(url, "http://localhost").searchParams.get("page"));
      listRequests.push(page);
      return { success: true, posts: [post(page)], pages: totalPages };
    }
    if (url.startsWith("/api/posts/notices")) return { success: true, posts: [], pages: 0 };
    if (url.startsWith("/api/rankings/")) return { success: true, items: [] };
    if (url.startsWith("/api/home/feed")) return { hotDiscussions: [] };
    return {};
  };
  return { fetcher, listRequests };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 모바일에서 바닥에 닿은 채 손가락을 끌거나 튕길 때처럼 scroll 이벤트를 여러 번 낸다. */
async function scrollAtBottom(times: number) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await wait(250);
    });
  }
}

function renderWith(ui: ReactNode, fetcher: (url: string) => Promise<unknown>) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher, dedupingInterval: 0 }}>{ui}</SWRConfig>
  );
}

beforeAll(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => observers.clear());

describe("반려생활 목록 무한 스크롤(bredy.app/posts 바닥 무한 갱신)", () => {
  it("더 받을 페이지가 없으면 바닥에서 계속 스크롤해도 목록을 다시 받지 않는다", async () => {
    const { fetcher, listRequests } = makeFetcher("/api/posts?", 1);
    renderWith(<PostsClient />, fetcher);
    expect(await screen.findByText("글 1")).toBeTruthy();

    await scrollAtBottom(5);
    await act(async () => {
      showSentinel();
      await wait(50);
    });

    expect(listRequests).toEqual([1]);
    expect(screen.queryByRole("status", { name: "불러오는 중" })).toBeNull();
  });

  it("바닥 감시 칸이 보이면 다음 페이지만 한 번 받고, 다 받은 뒤에는 더 부르지 않는다", async () => {
    const { fetcher, listRequests } = makeFetcher("/api/posts?", 2);
    renderWith(<PostsClient />, fetcher);
    expect(await screen.findByText("글 1")).toBeTruthy();

    await act(async () => {
      showSentinel();
      showSentinel();
      await wait(50);
    });
    expect(await screen.findByText("글 2")).toBeTruthy();

    await scrollAtBottom(3);
    await act(async () => {
      showSentinel();
      await wait(50);
    });

    expect(listRequests).toEqual([1, 2]);
  });
});

describe("공지사항 목록 무한 스크롤", () => {
  it("더 받을 페이지가 없으면 바닥에서 계속 스크롤해도 목록을 다시 받지 않는다", async () => {
    const { fetcher, listRequests } = makeFetcher("/api/posts/notices?", 1);
    renderWith(<NoticePostsClient />, fetcher);
    await waitFor(() => expect(listRequests).toEqual([1]));
    expect(await screen.findByText("글 1")).toBeTruthy();

    await scrollAtBottom(5);
    await act(async () => {
      showSentinel();
      await wait(50);
    });

    expect(listRequests).toEqual([1]);
  });

  it("바닥 감시 칸이 보이면 다음 페이지를 받는다", async () => {
    const { fetcher, listRequests } = makeFetcher("/api/posts/notices?", 2);
    renderWith(<NoticePostsClient />, fetcher);
    expect(await screen.findByText("글 1")).toBeTruthy();

    await act(async () => {
      showSentinel();
      await wait(50);
    });
    expect(await screen.findByText("글 2")).toBeTruthy();
    expect(listRequests).toEqual([1, 2]);
  });
});
