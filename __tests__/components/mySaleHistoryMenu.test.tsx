import { render, screen } from "@testing-library/react";

const mockUseParams = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));
const mockUseUser = jest.fn();
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock(
  "hooks/useUser",
  () => ({
    __esModule: true,
    default: () => mockUseUser(),
  }),
  { virtual: true }
);

import MySaleHistoryMenu from "@components/features/profile/MySaleHistoryMenu";

const me = { id: 7, name: "브리더" };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUser.mockReturnValue({ user: me });
});

describe("MySaleHistoryMenu 거래 메뉴", () => {
  it("다른 사람 프로필에는 판매내역·구매내역만 보이고 관심목록은 없다", () => {
    mockUseParams.mockReturnValue({ id: "99" });
    render(<MySaleHistoryMenu />);
    expect(screen.getByText("판매내역").closest("a")).toHaveAttribute(
      "href",
      "/profiles/99/sales"
    );
    expect(screen.getByText("구매내역").closest("a")).toHaveAttribute(
      "href",
      "/profiles/99/purchases"
    );
    expect(screen.queryByText("관심목록")).not.toBeInTheDocument();
  });

  it("비로그인으로 다른 사람 프로필을 보면 판매내역·구매내역만 보인다", () => {
    mockUseUser.mockReturnValue({ user: undefined });
    mockUseParams.mockReturnValue({ id: "99" });
    render(<MySaleHistoryMenu />);
    expect(screen.getByText("판매내역")).toBeInTheDocument();
    expect(screen.getByText("구매내역").closest("a")).toHaveAttribute(
      "href",
      "/profiles/99/purchases"
    );
    expect(screen.queryByText("관심목록")).not.toBeInTheDocument();
  });

  it.each([
    ["내 프로필", { id: "7" }],
    ["마이페이지", {}],
  ])("%s 에는 판매내역·구매내역·관심목록이 모두 보인다", (_where, params) => {
    mockUseParams.mockReturnValue(params);
    render(<MySaleHistoryMenu />);
    expect(screen.getByText("판매내역")).toBeInTheDocument();
    expect(screen.getByText("구매내역").closest("a")).toHaveAttribute(
      "href",
      "/profiles/7/purchases"
    );
    expect(screen.getByText("관심목록").closest("a")).toHaveAttribute(
      "href",
      "/profiles/7/favs"
    );
  });
});
