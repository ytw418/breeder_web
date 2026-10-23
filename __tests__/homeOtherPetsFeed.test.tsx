import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";

/**
 * 홈 '다른 아이들 소식'(앱 docs/prd/pet-space.md §5.7): 관심 분야를 고정한 사람이 고정 범위 글을 끝까지 보면
 * 아래에 범위 밖 게시글(outsideCategoryPath)을 이어 받는다.
 */

const DOG = "/mammal/dog/";

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
    default: () => ({
      categoryPath: "/mammal/dog/",
      pins: [{ id: 31, path: "/mammal/dog/", label: "포유류 > 강아지" }],
      topLevelNames: new Set(["포유류"]),
    }),
    withCategoryPath: (url: string, path?: string) =>
      path ? `${url}${url.includes("?") ? "&" : "?"}categoryPath=${encodeURIComponent(path)}` : url,
  }),
  { virtual: true }
);
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("@libs/client/analytics", () => ({
  ANALYTICS_EVENTS: new Proxy({}, { get: (_target, name) => String(name) }),
  trackEvent: jest.fn(),
}));

import HomePostsFeed from "../app/(web)/(main)/HomePostsFeed";

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

const post = (id: number, title = `글 ${id}`) => ({
  id,
  title,
  description: "본문",
  image: "",
  images: [],
  category: "자유",
  createdAt: "2026-10-09T00:00:00.000Z",
  user: { id: 100 + id, name: `작성자${id}`, avatar: null, breederPrograms: [] },
  _count: { comments: 0, Likes: 0 },
});

/** scoped: 범위 글 페이지들, outside: 범위 밖 글 페이지들. 범위 밖 요청 주소를 모은다. */
function makeFetcher({
  scoped,
  outside,
}: {
  scoped: ReturnType<typeof post>[][];
  outside: ReturnType<typeof post>[][];
}) {
  const outsideRequests: string[] = [];
  const fetcher = async (url: string) => {
    const params = new URL(url, "http://localhost").searchParams;
    const page = Number(params.get("page") ?? 1);
    if (url.startsWith("/api/posts?") && params.has("outsideCategoryPath")) {
      outsideRequests.push(url);
      return { success: true, posts: outside[page - 1] ?? [], pages: outside.length };
    }
    if (url.startsWith("/api/posts?")) {
      return { success: true, posts: scoped[page - 1] ?? [], pages: scoped.length };
    }
    if (url.startsWith("/api/products?")) return { success: true, products: [], pages: 0 };
    return {};
  };
  return { fetcher, outsideRequests };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function renderWith(fetcher: (url: string) => Promise<unknown>) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher, dedupingInterval: 0 }}>
      <HomePostsFeed />
    </SWRConfig>
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

describe("홈 '다른 아이들 소식'", () => {
  it("고정 범위 글을 다 받으면 제목 아래에 범위 밖 글을 이어 받고, 바닥에서 다음 페이지도 받는다", async () => {
    const { fetcher, outsideRequests } = makeFetcher({
      scoped: [[post(1, "강아지 글")]],
      outside: [[post(50, "다른 글 50")], [post(51, "다른 글 51")]],
    });
    renderWith(fetcher);

    expect(await screen.findByText("강아지 글")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "다른 아이들 소식" })).toBeTruthy();
    expect(screen.getByText("고른 분야 글은 다 봤어요. 다른 아이들 이야기도 둘러보세요.")).toBeTruthy();
    expect(await screen.findByText("다른 글 50")).toBeTruthy();
    expect(outsideRequests[0]).toContain(`outsideCategoryPath=${encodeURIComponent(DOG)}`);
    expect(new URL(outsideRequests[0], "http://localhost").searchParams.has("categoryPath")).toBe(false);

    await act(async () => {
      showSentinel();
      await wait(50);
    });
    expect(await screen.findByText("다른 글 51")).toBeTruthy();
  });

  it("고정 범위 글이 더 남아 있으면 범위 밖 글을 받지 않는다", async () => {
    const { fetcher, outsideRequests } = makeFetcher({
      scoped: [[post(1, "강아지 글")], [post(2, "강아지 글 2")]],
      outside: [[post(50, "다른 글 50")]],
    });
    renderWith(fetcher);

    expect(await screen.findByText("강아지 글")).toBeTruthy();
    await act(async () => {
      await wait(50);
    });
    expect(outsideRequests).toEqual([]);
    expect(screen.queryByRole("heading", { name: "다른 아이들 소식" })).toBeNull();
  });

  it("이미 보인 글은 다시 보이지 않는다(범위를 모르는 옛 서버)", async () => {
    const { fetcher } = makeFetcher({
      scoped: [[post(1, "강아지 글")]],
      outside: [[post(1, "강아지 글"), post(52, "다른 글 52")]],
    });
    renderWith(fetcher);

    expect(await screen.findByText("다른 글 52")).toBeTruthy();
    expect(screen.getAllByText("강아지 글")).toHaveLength(1);
  });

  it("고정 범위 글이 하나도 없으면 빈 안내 아래에 다른 아이들 글을 보인다", async () => {
    const { fetcher } = makeFetcher({ scoped: [[]], outside: [[post(60, "다른 글 60")]] });
    renderWith(fetcher);

    expect(await screen.findByText("다른 글 60")).toBeTruthy();
    expect(screen.getByText(/아직 올라온 글이 없어요/)).toBeTruthy();
    expect(screen.getByText("고른 분야 글이 올라오는 동안 다른 아이들 이야기를 둘러보세요.")).toBeTruthy();
  });
});
