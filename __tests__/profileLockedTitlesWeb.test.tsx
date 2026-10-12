import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { ProfileBlock, lockedTitleText } from "@components/features/profile/ProfileBlock";
import ProfileCompletionCard from "@components/features/profile/ProfileCompletionCard";

const user = {
  name: "초보집사민",
  createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
  regionSido: "서울특별시",
  regionSigungu: "구로구",
  _count: { followers: 0, following: 0, posts: 4 },
  lockedTitles: [
    { key: "talk", label: "소통왕", remaining: { kind: "comment" as const, count: 2 } },
    { key: "post", label: "기록왕", remaining: { kind: "post" as const, count: 1 } },
    { key: "photo", label: "사진 맛집", remaining: { kind: "photo" as const, count: 3 } },
  ],
};

describe("프로필 잠금 칭호·신뢰 줄·완성 카드(community-vibe §3.3·§3.8)", () => {
  it("본인 프로필엔 잠금 칭호 pill 3개('소통왕까지 댓글 2')", () => {
    render(<ProfileBlock userId={1} user={user} loading={false} isMine />);
    const pills = screen.getAllByTestId("locked-title-pill");
    expect(pills.map((pill) => pill.textContent)).toEqual([
      "소통왕까지 댓글 2",
      "기록왕까지 글 1",
      "사진 맛집까지 3장",
    ]);
    expect(pills[1]).toHaveAttribute("href", "/posts/upload");
  });

  it("타인 프로필엔 잠금 칭호를 보이지 않는다", () => {
    render(<ProfileBlock userId={1} user={user} loading={false} isMine={false} />);
    expect(screen.queryAllByTestId("locked-title-pill")).toHaveLength(0);
  });

  it("신뢰 줄 끝에 동네 범위 라벨('브리디 1개월차 · 서울')", () => {
    render(<ProfileBlock userId={1} user={user} loading={false} isMine />);
    expect(screen.getByText("브리디 1개월차 · 서울")).toBeInTheDocument();
  });

  it("lockedTitleText 형식", () => {
    expect(lockedTitleText({ key: "x", label: "분양왕", remaining: { kind: "listing", count: 2 } })).toBe("분양왕까지 분양글 2");
  });

  it("완성 카드: 'N / 7' 주황 숫자와 주황 진행 바, 다음 할 일", () => {
    render(
      <ProfileCompletionCard
        user={{ avatar: null, bio: "안녕", _count: {} }}
        photoPosts={[]}
        userAlbumCount={0}
        onGoPhotosTab={() => undefined}
      />
    );
    const card = screen.getByTestId("profile-completion-card");
    expect(card.textContent).toContain("1 / 7");
    expect(card.textContent).toContain("프로필 사진");
    expect(screen.getByRole("progressbar")).toHaveClass("bg-app-brand-track");
  });
});
