import { render, screen } from "@testing-library/react";

jest.mock("hooks/useUser", () => ({ __esModule: true, default: () => ({ user: null }) }), { virtual: true });
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

import {
  NeighborhoodBreederSectionView,
  neighborhoodEmptyCopy,
  resolveHomeNeighborhood,
  toNeighborCard,
} from "@components/features/home/NeighborhoodBreederSection";

const guro = { sido: "서울특별시", sigungu: "구로구" };
const me = { name: "초보집사민", image: null, species: "레오파드 게코" };

const contractItem = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `브리더${id}`,
  image: null,
  topSpecies: "크레스티드 게코",
  regionSido: "서울특별시",
  regionSigungu: "구로구",
  distanceKm: 0,
  sameRegion: true,
  isFollowing: false,
  badges: [],
  breederPrograms: [],
  ...extra,
});

const resolve = (data: Parameters<typeof resolveHomeNeighborhood>[0]["data"], regionVisible = true) =>
  resolveHomeNeighborhood({ loggedIn: true, region: guro, regionVisible, me, data, isError: false, visitors: null });

describe("홈 우리 동네 브리더(강조, community-vibe §3.6)", () => {
  it("near: 위치 칩 '서울 근처 50km', 부제 'N명 · 인사 글 M개', 카드 거리·팔로우, 사랑방·인사 링크", () => {
    const state = resolve({
      scope: "near",
      regionLabel: "서울",
      total: 12,
      greetingCount: 3,
      items: [
        contractItem(1),
        contractItem(2, { regionSido: "경기도", regionSigungu: "광명시", distanceKm: 6, sameRegion: false, isFollowing: true }),
      ],
    });
    render(<NeighborhoodBreederSectionView state={state} />);
    expect(screen.getByTestId("neighborhood-location-chip")).toHaveTextContent("서울 근처 50km");
    expect(screen.getByTestId("neighborhood-location-chip")).toHaveAttribute("href", "/settings/region");
    expect(screen.getByTestId("neighborhood-subtitle")).toHaveTextContent("서울 근처 브리더 12명 · 이번 주 인사 글 3개");
    expect(screen.getByText("같은 동네")).toBeInTheDocument();
    expect(screen.getByText("광명시 · 6km")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팔로잉, 누르면 팔로우 취소" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "동네 사랑방" })).toHaveAttribute("href", `/posts?category=${encodeURIComponent("동네")}`);
    expect(screen.getByRole("link", { name: "인사 남기기" })).toHaveAttribute("href", `/posts/upload?category=${encodeURIComponent("동네")}`);
    expect(screen.queryByTestId("neighborhood-me-card")).toBeNull();
  });

  it("내가 노출을 꺼 두었으면 맨 끝에 '나도 보이기' 카드(동네 설정)", () => {
    const state = resolve({ scope: "near", regionLabel: "서울", total: 1, greetingCount: 0, items: [contractItem(1)] }, false);
    render(<NeighborhoodBreederSectionView state={state} />);
    expect(screen.getByTestId("neighborhood-me-card")).toHaveTextContent("아직 안 보여요");
    expect(screen.getByRole("link", { name: "나도 보이기" })).toHaveAttribute("href", "/settings/region");
  });

  it("옛 응답(user·region·topSpecies 배열)도 카드로 바꾼다", () => {
    expect(
      toNeighborCard({ user: { id: 5, name: "콩", avatar: null }, region: guro, topSpecies: ["레게", "크레", "볼"], isFollowing: true })
    ).toEqual({ id: 5, name: "콩", image: null, species: "레게 · 크레", place: "구로구", isFollowing: true });
  });

  it("none: '없어요'로 끝나지 않고 인사 남기기 버튼, 방문자 수가 있으면 둘째 줄에", () => {
    expect(neighborhoodEmptyCopy("보은군 근처", 4)).toEqual({
      title: "보은군 근처 첫 브리더가 되어 보세요",
      body: "이번 주 보은군 근처에서 4명이 둘러봤어요",
    });
    expect(neighborhoodEmptyCopy("서울", 0).body).toBe("인사 글은 근처 브리더 홈에 바로 보여요");
    render(<NeighborhoodBreederSectionView state={{ kind: "none", label: "보은군 근처", visitors: null }} />);
    const card = screen.getByTestId("neighborhood-empty");
    expect(card.textContent).not.toMatch(/없어요/);
    expect(screen.getByRole("link", { name: "인사 남기기" })).toBeInTheDocument();
    expect(screen.getByTestId("neighborhood-location-chip")).toHaveTextContent("보은군 근처 50km");
  });

  it("unset: 비로그인은 로그인으로, hidden 이면 아무것도 없다", () => {
    const { unmount } = render(<NeighborhoodBreederSectionView state={{ kind: "unset", loggedIn: false }} />);
    expect(screen.getByRole("link", { name: "내 동네 설정" })).toHaveAttribute(
      "href",
      // 로그인을 거쳐 내 동네를 정하면 '완료' 뒤 홈으로 돌아온다(from).
      `/login?next=${encodeURIComponent("/settings/region?from=%2F")}`
    );
    unmount();
    const { container } = render(<NeighborhoodBreederSectionView state={{ kind: "hidden" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
