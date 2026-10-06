import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/posts",
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
    expect(screen.getByRole("link", { name: "반려생활" })).toHaveAttribute("aria-current", "page");
  });

  it("로그인이면 채팅 unread 9+ 뱃지와 알림 99+ 뱃지를 보인다", () => {
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
    expect(screen.getByRole("link", { name: "알림" })).toHaveClass("text-app-danger");
    expect(screen.getAllByText("99+").length).toBeGreaterThan(0);
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

  it("chat-list 헤더는 제목 + headerRight + 알림 벨", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false });
    render(
      <MainLayout title="채팅" headerVariant="chat-list" headerRight={<button type="button">검색</button>}>
        <p>본문</p>
      </MainLayout>
    );
    expect(screen.getByRole("heading", { name: "채팅" })).toHaveClass("text-[18px]");
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
});
