import { render, screen, within } from "@testing-library/react";

/**
 * 목록 카드 작성자 표시(bredy_app design/mockups/author-row/A-karrot.html A안, PRD bredy_app docs/prd/author-row.md):
 * 아바타·닉네임은 프로필 링크, 카드의 나머지는 상세 링크(투명하게 덮는 링크). 링크 안에 링크를 넣지 않는다.
 */
const mockUseUser = jest.fn();
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);

import { PostCard, type PostCardData } from "@components/app/PostCard";
import { ProductCard, type ProductCardData } from "@components/app/ProductCard";
import { AuctionCard } from "@/app/(web)/auctions/AuctionCard";
import type { AuctionWithUser } from "pages/api/auctions";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

const recent = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

const founding = {
  id: 1,
  programType: "FOUNDING_BREEDER",
  status: "ACTIVE",
  badgeLabel: "창립 브리더",
  foundingNo: 3,
} as BreederProgramSummary;

const breeder = { id: 2, name: "사슴벌레아빠", avatar: null, breederPrograms: [founding] };

beforeEach(() => {
  window.localStorage.clear();
  mockUseUser.mockReturnValue({ user: { id: 7 } });
});

/** 링크 안에 링크가 없어야 한다(HTML 규칙). */
const expectNoNestedLinks = (container: HTMLElement) => {
  expect(container.querySelector("a a")).toBeNull();
};

describe("PostCard 작성자 줄", () => {
  const post: PostCardData = {
    id: 501,
    title: "조명 바꿨더니 발색이 확 살았어요",
    description: "구피 꼬리 색이 완전히 달라 보여요.",
    category: "자랑",
    createdAt: recent,
    user: breeder,
    _count: { Likes: 8, comments: 4 },
  };

  it("맨 위 작성자 줄의 아바타·닉네임은 프로필로, 카드는 상세로 간다", () => {
    const { container } = render(<PostCard post={post} />);
    const author = screen.getByRole("link", { name: "사슴벌레아빠 프로필" });
    expect(author).toHaveAttribute("href", "/profiles/2");
    expect(within(author).getByText("사슴벌레아빠")).toBeInTheDocument();
    const detail = screen.getByRole("link", { name: post.title });
    expect(detail.getAttribute("href")).toMatch(/^\/posts\/501/);
    expectNoNestedLinks(container);
  });

  it("작성자 줄에 뱃지와 시간, 아래 메타는 카테고리·좋아요만", () => {
    render(<PostCard post={post} />);
    expect(screen.getByText("창립 브리더 No.003")).toBeInTheDocument();
    expect(screen.getByText("· 3시간 전")).toBeInTheDocument();
    expect(screen.getByText("자랑 · 좋아요 8")).toBeInTheDocument();
  });

  it("질문 글에 좋아요가 없으면 아래 메타 줄을 그리지 않는다", () => {
    render(
      <PostCard post={{ ...post, category: "질문", _count: { Likes: 0, comments: 0 } }} />
    );
    expect(screen.queryByText(/좋아요/)).toBeNull();
    expect(screen.queryByText("질문 ·", { exact: false })).toBeNull();
  });
});

describe("ProductCard 판매자", () => {
  const product: ProductCardData = {
    id: 237,
    name: "크레스티드 게코 릴리화이트 해칭 개체",
    price: 350000,
    createdAt: recent,
    category: "파충류",
    viewCount: 31,
    sellerId: 2,
  };

  it("seller 를 넘기면 메타 맨 앞에 프로필 링크, 행은 상세 링크", () => {
    const { container } = render(<ProductCard product={{ ...product, seller: breeder }} />);
    expect(screen.getByRole("link", { name: "사슴벌레아빠 프로필" })).toHaveAttribute(
      "href",
      "/profiles/2"
    );
    expect(screen.getByText("· 파충류 · 3시간 전 · 조회 31")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: product.name }).getAttribute("href")).toMatch(
      /^\/products\/237/
    );
    expectNoNestedLinks(container);
  });

  it("seller 가 없으면(프로필 내역) 판매자 없이 지금 메타 그대로", () => {
    render(<ProductCard product={product} />);
    expect(screen.queryByRole("link", { name: /프로필$/ })).toBeNull();
    expect(screen.getByText("파충류 · 3시간 전 · 조회 31")).toBeInTheDocument();
  });

  it("삭제된 상품은 상세 링크가 없다", () => {
    render(<ProductCard product={{ ...product, isDeleted: true }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("AuctionCard 판매자 줄", () => {
  const auction = {
    id: 41,
    title: "왕사슴벌레 피닉스 혈 1페어",
    status: "진행중",
    category: "곤충",
    photos: [],
    currentPrice: 80000,
    winnerId: null,
    userId: 2,
    createdAt: recent,
    endAt: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    user: breeder,
    _count: { bids: 4 },
  } as unknown as AuctionWithUser;

  it("카드 맨 아래 판매자 줄은 프로필로, 카드는 상세로, 뱃지는 그 아래", () => {
    const { container } = render(<AuctionCard auction={auction} nowMs={Date.now()} />);
    expect(screen.getByRole("link", { name: "사슴벌레아빠 프로필" })).toHaveAttribute(
      "href",
      "/profiles/2"
    );
    expect(screen.getByRole("link", { name: auction.title }).getAttribute("href")).toMatch(
      /^\/auctions\/41/
    );
    expect(screen.getByText("창립 브리더 No.003")).toBeInTheDocument();
    expect(screen.getByText("입찰 4회")).toBeInTheDocument();
    expectNoNestedLinks(container);
  });
});
