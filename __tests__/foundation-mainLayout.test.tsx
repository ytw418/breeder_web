import { fireEvent, render, screen } from "@testing-library/react";

const mockPathname = jest.fn(() => "/products");
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock("@images/logo.png", () => ({
  __esModule: true,
  default: { src: "/logo.png", width: 32, height: 32 },
}));
const mockUseUser = jest.fn();
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);
jest.mock(
  "hooks/useLogout",
  () => ({ __esModule: true, default: () => jest.fn() }),
  { virtual: true }
);
const mockUseSWR = jest.fn();
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => mockUseSWR(key),
}));

import MainLayout from "@components/features/MainLayout";

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname.mockReturnValue("/products");
  mockUseSWR.mockReturnValue({ data: undefined });
});

describe("MainLayout 셸", () => {
  it("비로그인이면 채팅·마이 탭이 로그인(next)으로 간다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="반려생활" icon hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.getByRole("link", { name: "채팅" })).toHaveAttribute(
      "href",
      `/auth/login?next=${encodeURIComponent("/chat")}`
    );
    expect(screen.getByRole("link", { name: "마이페이지" })).toHaveAttribute(
      "href",
      `/auth/login?next=${encodeURIComponent("/myPage")}`
    );
    expect(screen.getByRole("link", { name: "분양" })).toHaveAttribute("aria-current", "page");
  });

  it("로그인이면 채팅 unread 9+ 뱃지, 알림 벨은 숫자 없이 점", () => {
    window.localStorage.removeItem("bredy:notifications:seenAt");
    mockUseUser.mockReturnValue({ user: { id: 1, name: "브리더" }, isLoading: false });
    mockUseSWR.mockImplementation((key: string | null) => ({
      data:
        key === "/api/chat/unread-count"
          ? { success: true, unreadCount: 12 }
          : key === "/api/notifications/unread-count"
            ? { success: true, unreadCount: 120 }
            : undefined,
    }));
    render(
      <MainLayout title="반려생활" icon hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.getByRole("link", { name: /채팅/ })).toHaveAttribute("href", "/chat");
    expect(screen.getByText("9+")).toBeInTheDocument();
    const bell = screen.getByRole("link", { name: "알림, 새 알림 있음" });
    expect(bell).toContainElement(screen.getByTestId("notification-dot"));
    expect(bell).not.toHaveTextContent("99+");
  });

  it("알림 화면을 연 뒤에 온 알림만 점, 연 뒤로 새 알림이 없으면 점이 사라진다", () => {
    mockUseUser.mockReturnValue({ user: { id: 1, name: "브리더" }, isLoading: false });
    const latest = "2026-10-12T10:00:00.000Z";
    mockUseSWR.mockImplementation((key: string | null) => ({
      data:
        key === "/api/notifications/unread-count"
          ? { success: true, unreadCount: 3, latestUnreadAt: latest }
          : undefined,
    }));
    window.localStorage.setItem("bredy:notifications:seenAt", String(Date.parse(latest) - 60_000));
    const { unmount } = render(
      <MainLayout title="반려생활" icon hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.getByTestId("notification-dot")).toBeInTheDocument();
    unmount();
    // 알림 화면을 열었다(markNotificationsSeen) → 점 없음.
    window.localStorage.setItem("bredy:notifications:seenAt", String(Date.parse(latest) + 1));
    render(
      <MainLayout title="반려생활" icon hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.queryByTestId("notification-dot")).toBeNull();
    expect(screen.getByRole("link", { name: "알림" })).toBeInTheDocument();
  });

  it("하단 탭(분양·경매)에는 안 본 새 글 점을 달지 않는다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="홈" icon hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.queryByLabelText("안 본 새 글")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "경매" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "분양" })).toBeInTheDocument();
  });

  it("headerRight 는 뒤로가기 화면의 벨·메뉴 자리를 바꾼다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout canGoBack title="상세" headerRight={<button type="button">더보기</button>}>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.getByRole("button", { name: "더보기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "메뉴" })).not.toBeInTheDocument();
  });

  it("chat-list 헤더는 왼쪽 로고(홈) + headerRight + 알림 벨, 제목 글자는 보이지 않는다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="채팅" headerVariant="chat-list" headerRight={<button type="button">검색</button>}>
        <p>본문</p>
      </MainLayout>
    );
    const brand = screen.getByTestId("header-brand");
    expect(brand).toHaveAttribute("href", "/");
    expect(brand).not.toHaveTextContent("브리디");
    expect(screen.getByRole("heading", { name: "채팅" })).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "검색" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "알림" })).toBeInTheDocument();
  });

  it("메뉴를 열면 비로그인은 로그인 / 회원가입 버튼과 섹션이 보인다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="홈" icon showSearch hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    fireEvent.click(screen.getByRole("button", { name: "메뉴" }));
    expect(screen.getByRole("button", { name: "로그인 / 회원가입" })).toBeInTheDocument();
    for (const section of ["활동", "거래", "혈통", "기타"]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
    expect(screen.getByText(/^버전 /)).toBeInTheDocument();
  });

  it("홈 헤더는 왼쪽 로고 + 워드마크 '브리디', 가운데 제목이 없다(community-vibe §3.7)", () => {
    mockPathname.mockReturnValue("/");
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="브리디" icon showSearch hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    const brand = screen.getByTestId("header-brand");
    expect(brand).toHaveTextContent("브리디");
    expect(brand.querySelector(".app-t-section")).not.toBeNull();
    // 검색엔진용 h1 은 화면에 보이지 않게(sr-only)만 둔다.
    expect(screen.getByRole("heading", { level: 1, name: "브리디" })).toHaveClass("sr-only");
  });

  it("다른 탭 루트는 왼쪽 로고만(누르면 홈), 탭 이름 글자는 보이지 않는다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="반려생활" icon showSearch hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    const brand = screen.getByTestId("header-brand");
    expect(brand).toHaveAttribute("href", "/");
    expect(brand.textContent).toBe("");
    // 제목은 화면 읽기용(sr-only) 하나만 남는다.
    expect(screen.getByRole("heading", { name: "반려생활" })).toHaveClass("sr-only");
  });

  it("상세 화면 homeAction: 왼쪽 뒤로 옆 브리디 로고(홈), 오른쪽은 화면 액션 · 메뉴, 헤더 제목은 제목 태그가 아니다", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout canGoBack homeAction title="상세" headerRight={<button type="button">더보기</button>}>
        <p>본문</p>
      </MainLayout>
    );
    const home = screen.getByRole("link", { name: "브리디 홈으로 가기" });
    expect(home).toHaveAttribute("href", "/");
    expect(home.parentElement).toContainElement(screen.getByRole("button", { name: "뒤로가기" }));
    const right = screen.getByRole("button", { name: "메뉴" }).parentElement as HTMLElement;
    expect(right.children).toHaveLength(2);
    expect(right.firstElementChild).toBe(screen.getByRole("button", { name: "더보기" }));
    // 상세는 본문 제목이 h1 이다(검색 최적화).
    expect(screen.queryByRole("heading", { name: "상세" })).toBeNull();
  });

  it("탭바는 한 세트 아이콘이고 선택 탭만 채움, 경매는 망치 아이콘", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    const { container } = render(
      <MainLayout title="반려생활" icon hasTabBar>
        <p>본문</p>
      </MainLayout>
    );
    const icons = Array.from(container.querySelectorAll("nav svg[data-icon]"));
    // 2026-10-15 홈 구성 A안(docs/prd/home-ia.md): 반려생활 탭 → 분양 탭(가격표).
    expect(icons.map((el) => el.getAttribute("data-icon"))).toEqual([
      "home",
      "sale",
      "auctions",
      "chat",
      "my",
    ]);
    expect(icons.filter((el) => el.getAttribute("data-filled") === "true").map((el) => el.getAttribute("data-icon"))).toEqual(["sale"]);
  });
});
