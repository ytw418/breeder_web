import { fireEvent, render, screen } from "@testing-library/react";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => ({ user: { id: 7 }, isLoading: false }) }),
  { virtual: true }
);
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import MySellHistoryList from "@components/features/profile/MySellHistoryList";
import { ProfileProductRows } from "@components/features/profile/ProfileActivityLists";

describe("MySellHistoryList 삭제·숨김 상품", () => {
  const record = (id: number, product: Record<string, unknown>) => ({
    id,
    userId: 7,
    productId: id,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    product: {
      id,
      name: `상품 ${id}`,
      price: 10000,
      description: "설명",
      photos: [],
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      _count: { favs: 0 },
      isDeleted: false,
      isHidden: false,
      ...product,
    },
  });

  it("삭제·숨김 상품은 링크 없이 '삭제된 상품'·'숨김 상품'으로 보이고, 살아 있는 상품은 링크로 보인다", () => {
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: {
        success: true,
        mySellHistoryData: [
          record(1, {}),
          record(2, { isDeleted: true }),
          record(3, { isHidden: true }),
        ],
      },
    });
    render(<MySellHistoryList kind="purchases" id={7} />);

    // 상세 링크는 행을 투명하게 덮는 링크(이름을 aria-label 로 가진다)라 이름 글자의 조상이 아니다.
    expect(screen.getByRole("link", { name: "상품 1" })).toBeInTheDocument();
    for (const name of ["상품 2", "상품 3"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    expect(screen.getAllByText("삭제된 상품")).toHaveLength(1);
    expect(screen.getAllByText("숨김 상품")).toHaveLength(1);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("ProfileProductRows 가격 표시", () => {
  const product = (id: number, price?: number) => ({
    id,
    name: `상품 ${id}`,
    price,
    description: "설명",
    photos: ["img-1"],
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    _count: { favs: 0 },
  });
  const list = (items: ReturnType<typeof product>[]) => ({
    items,
    isLoading: false,
    isError: false,
    isLoaded: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    loadMore: jest.fn(),
    refetch: jest.fn(),
  });

  it("0원은 무료나눔, 가격이 없으면 가격 미정으로 보인다", () => {
    render(<ProfileProductRows list={list([product(1, 0), product(2), product(3, 10000)])} />);

    expect(screen.getByText("무료나눔")).toBeInTheDocument();
    expect(screen.getByText("가격 미정")).toBeInTheDocument();
    expect(screen.getByText("10,000원")).toBeInTheDocument();
  });

  it("다음 페이지가 있으면 더보기로 이어 받는다", () => {
    const state = { ...list([product(1, 100)]), hasNextPage: true };
    render(<ProfileProductRows list={state} />);
    fireEvent.click(screen.getByRole("button", { name: "상품 더보기" }));
    expect(state.loadMore).toHaveBeenCalledTimes(1);
  });
});

describe("MySellHistoryList 오류 처리", () => {
  const emptyTexts = ["아직 구매 내역이 없습니다", "아직 관심 상품이 없습니다"];
  const swrError = (status: number, message = "요청 처리 중 오류가 발생했습니다.") =>
    Object.assign(new Error(message), { status });

  const expectNoEmptyState = () => {
    for (const text of emptyTexts) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  };

  it("id 가 양의 정수가 아니면(/profiles/abc/sales) /api/users/NaN 을 요청하지 않고 내 id 경로로 바꾼다", () => {
    mockUseSWR.mockReturnValue({ isLoading: false, data: undefined, error: undefined, mutate: jest.fn() });
    render(<MySellHistoryList kind="sales" id={Number("abc")} />);

    expect(mockUseSWR).toHaveBeenLastCalledWith(null);
    expect(mockReplace).toHaveBeenCalledWith("/profiles/7/sales");
  });

  it("401 이면 빈 상태 대신 로그인 안내와 로그인 링크를 보인다", () => {
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: swrError(401, "로그인이 필요합니다."),
      mutate: jest.fn(),
    });
    render(<MySellHistoryList kind="favs" id={7} />);

    expect(screen.getByText("로그인이 필요합니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute(
      "href",
      `/auth/login?next=${encodeURIComponent("/profiles/7/favs")}`
    );
    expectNoEmptyState();
  });

  it("403 이면 본인만 볼 수 있다고 안내한다", () => {
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: swrError(403, "본인의 관심목록만 볼 수 있습니다."),
      mutate: jest.fn(),
    });
    render(<MySellHistoryList kind="favs" id={99} />);

    expect(screen.getByText("관심목록은 본인만 볼 수 있습니다.")).toBeInTheDocument();
    expectNoEmptyState();
  });

  it("403 이면 서버 문구와 관계없이 앱과 같은 문구를 보인다", () => {
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: swrError(403, ""),
      mutate: jest.fn(),
    });
    render(<MySellHistoryList kind="favs" id={99} />);

    expect(screen.getByText("관심목록은 본인만 볼 수 있습니다.")).toBeInTheDocument();
    expectNoEmptyState();
  });

  it("그 밖의 오류는 불러올 수 없다고 안내하고 다시 시도로 재요청한다", () => {
    const mutate = jest.fn();
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: swrError(500),
      mutate,
    });
    render(<MySellHistoryList kind="purchases" id={7} />);

    expect(screen.getByText("구매내역을 불러올 수 없습니다.")).toBeInTheDocument();
    expectNoEmptyState();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("성공 응답이 비어 있을 때만 빈 상태를 보인다", () => {
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: { success: true, mySellHistoryData: [] },
      error: undefined,
      mutate: jest.fn(),
    });
    render(<MySellHistoryList kind="purchases" id={7} />);

    expect(screen.getByText("아직 구매 내역이 없습니다")).toBeInTheDocument();
  });
});
