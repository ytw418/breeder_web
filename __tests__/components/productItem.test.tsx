import { render, screen } from "@testing-library/react";

const mockUseSWR = jest.fn();
jest.mock("swr", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Item from "@components/features/item/item";
import MySellHistoryList from "@components/features/profile/MySellHistoryList";
import MyPostList from "@components/features/profile/MyPostList";

const baseItem = {
  title: "왕사슴 유충",
  id: 3,
  hearts: 0,
  image: "img-1",
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
};

describe("Item 가격 표시", () => {
  it("0원은 무료나눔으로 보인다", () => {
    render(<Item {...baseItem} price={0} />);
    expect(screen.getByText("무료나눔")).toBeInTheDocument();
    expect(screen.queryByText("가격 미정")).not.toBeInTheDocument();
  });

  it("가격이 없으면 가격 미정", () => {
    render(<Item {...baseItem} price={null} />);
    expect(screen.getByText("가격 미정")).toBeInTheDocument();
  });

  it("가격이 있으면 원 단위로 보인다", () => {
    render(<Item {...baseItem} price={10000} />);
    expect(screen.getByText("10,000원")).toBeInTheDocument();
  });
});

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

  it("삭제·숨김 상품은 링크 없이 '삭제된 상품'으로 보이고, 살아 있는 상품은 링크로 보인다", () => {
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

    expect(screen.getByText("상품 1").closest("a")).not.toBeNull();
    for (const name of ["상품 2", "상품 3"]) {
      expect(screen.getByText(name).closest("a")).toBeNull();
    }
    expect(screen.getAllByText("삭제된 상품")).toHaveLength(2);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("MyPostList 가격 표시", () => {
  const product = (id: number, price?: number) => ({
    id,
    name: `상품 ${id}`,
    price,
    description: "설명",
    photos: ["img-1"],
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    _count: { favs: 0 },
  });

  it("0원은 무료나눔, 가격이 없으면 가격 미정으로 보인다", () => {
    mockUseSWR.mockReturnValue({
      isLoading: false,
      data: { success: true, products: [product(1, 0), product(2), product(3, 10000)] },
    });
    render(<MyPostList userId={7} />);

    expect(screen.getByText("무료나눔")).toBeInTheDocument();
    expect(screen.getByText("가격 미정")).toBeInTheDocument();
    expect(screen.getByText("10,000원")).toBeInTheDocument();
  });
});
