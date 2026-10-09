import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("hooks/useUser", () => ({ __esModule: true, default: () => ({ user: null }) }), { virtual: true });
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { NeighborhoodBreederSectionView } from "@components/features/home/NeighborhoodBreederSection";
import type { NeighborhoodSectionState } from "@libs/shared/neighborhoodSection";
import type { NearbyBreederItem } from "@libs/server/nearby";

const gangnam = { sido: "서울특별시", sigungu: "강남구" };
const breeder = (id: number, extra: Partial<NearbyBreederItem> = {}): NearbyBreederItem => ({
  user: { id, name: `브리더${id}`, avatar: null },
  region: gangnam,
  postsCount: 3,
  commentsCount: 7,
  breederPrograms: [],
  isFollowing: false,
  topSpecies: [],
  ...extra,
});

function renderView(state: NeighborhoodSectionState<NearbyBreederItem>, onShowMe = jest.fn()) {
  return render(<NeighborhoodBreederSectionView state={state} visibleSaving={false} onShowMe={onShowMe} />);
}

describe("홈 우리 동네 브리더 섹션(웹)", () => {
  it("filled: 보조 줄·카드·팔로우 상태·사랑방/인사 링크, 표시 중이면 스위치 줄 없음", () => {
    renderView({
      kind: "filled",
      region: gangnam,
      items: [breeder(1, { isFollowing: true, topSpecies: ["레오파드게코", "크레"] }), breeder(2)],
      total: 12,
      showVisibleSwitch: false,
    });
    expect(screen.getByText("강남구 · 12명")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 보기 ›" })).toHaveAttribute("href", "/neighborhood/breeders");
    expect(screen.getByRole("link", { name: "브리더1, 레오파드게코 · 크레" })).toHaveAttribute("href", "/profiles/1");
    expect(screen.getByText("글 3 · 댓글 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팔로잉, 누르면 팔로우 취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팔로우" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "동네 사랑방" })).toHaveAttribute(
      "href",
      `/posts?category=${encodeURIComponent("동네")}`
    );
    expect(screen.getByRole("link", { name: "인사 남기기" })).toHaveAttribute(
      "href",
      `/posts/upload?category=${encodeURIComponent("동네")}`
    );
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("widened: 넓힘 안내, 카드 앞에 구 이름, 표시 OFF 면 스위치 줄을 눌러 켠다", () => {
    const onShowMe = jest.fn();
    renderView(
      {
        kind: "widened",
        region: gangnam,
        items: [breeder(3, { region: { sido: "서울특별시", sigungu: "마포구" }, topSpecies: ["왕사슴벌레"] })],
        total: 1,
        showVisibleSwitch: true,
      },
      onShowMe
    );
    expect(screen.getByText("강남구엔 아직 없어 서울 전체를 보여드려요")).toBeInTheDocument();
    expect(screen.getByText("마포구 · 왕사슴벌레")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "나도 동네 브리더로 보이기" }));
    expect(onShowMe).toHaveBeenCalledTimes(1);
  });

  it("unset: 비로그인은 로그인으로, 로그인은 내 동네 설정으로", () => {
    const { unmount } = renderView({ kind: "unset", loggedIn: false });
    expect(screen.getByText("가까운 브리더를 만나 보세요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 동네 설정" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent("/settings/region")}`
    );
    expect(screen.queryByRole("link", { name: "전체 보기 ›" })).not.toBeInTheDocument();
    unmount();
    renderView({ kind: "unset", loggedIn: true });
    expect(screen.getByRole("link", { name: "내 동네 설정" })).toHaveAttribute("href", "/settings/region");
  });

  it("none: 표시 OFF 는 '나를 표시하기'+'인사 남기기', 표시 ON 은 '인사 남기기' 하나", () => {
    const onShowMe = jest.fn();
    const { unmount } = renderView({ kind: "none", region: gangnam, visible: false }, onShowMe);
    expect(screen.getByText("강남구 첫 동네 브리더가 되어 보세요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "나를 표시하기" }));
    expect(onShowMe).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "인사 남기기" })).toBeInTheDocument();
    unmount();
    renderView({ kind: "none", region: gangnam, visible: true });
    expect(screen.getByText("아직 서울에 다른 브리더가 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "나를 표시하기" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "인사 남기기" })).toHaveLength(1);
  });

  it("hidden 이면 아무것도 그리지 않는다", () => {
    const { container } = renderView({ kind: "hidden" });
    expect(container).toBeEmptyDOMElement();
  });
});
