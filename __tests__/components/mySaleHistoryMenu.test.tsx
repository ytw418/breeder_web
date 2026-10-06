import { render, screen } from "@testing-library/react";

import { TransactionMenu } from "@components/features/profile/ProfileRows";

describe("TransactionMenu 거래 메뉴(앱 TransactionMenu)", () => {
  it("다른 사람 프로필에는 판매내역·구매내역만 보이고 관심목록은 없다", () => {
    render(<TransactionMenu userId={99} isMine={false} />);
    expect(screen.getByText("판매내역").closest("a")).toHaveAttribute("href", "/profiles/99/sales");
    expect(screen.getByText("구매내역").closest("a")).toHaveAttribute("href", "/profiles/99/purchases");
    expect(screen.queryByText("관심목록")).not.toBeInTheDocument();
  });

  it("내 프로필·마이페이지에는 판매내역·구매내역·관심목록이 모두 보인다", () => {
    render(<TransactionMenu userId={7} isMine />);
    expect(screen.getByText("판매내역")).toBeInTheDocument();
    expect(screen.getByText("구매내역").closest("a")).toHaveAttribute("href", "/profiles/7/purchases");
    expect(screen.getByText("관심목록").closest("a")).toHaveAttribute("href", "/profiles/7/favs");
  });
});
