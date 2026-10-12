import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";

jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));

import TopBreederRankCard, {
  myRankHeadline,
  normalizeRankingMe,
  withRo,
} from "@components/features/home/TopBreederRankCard";
import type { BreederRankingItem } from "@libs/shared/ranking";

const hero: BreederRankingItem = {
  rank: 1,
  previousRank: null,
  rankDelta: 0,
  score: 42,
  scoreDelta: 0,
  postsCount: 4,
  commentsCount: 1,
  bidsCount: 0,
  auctionWinsCount: 0,
  sellerEndedAuctionsCount: 0,
  user: { id: 9, name: "뿡뿡이잉", avatar: null },
  badges: [],
};
const keyword = { key: "listing", label: "분양왕", emoji: "", detail: "분양글 1개", parts: ["분양글 1개"] } as const;

function renderCard(viewer: { id: number; name: string; avatar: string | null } | null, fetcher: (url: string) => unknown) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: async (url: string) => fetcher(url), dedupingInterval: 0 }}>
      <TopBreederRankCard
        hero={hero}
        keyword={{ ...keyword, parts: [...keyword.parts] } as never}
        period="weekly"
        scoped={false}
        viewer={viewer}
        viewerLoading={false}
      />
    </SWRConfig>
  );
}

describe("홈 TOP 브리더 내 순위 줄(community-vibe §3.2)", () => {
  it("1위 행: 칭호 pill + '분양글 1개로 이번 주 1위' + '42점 · 기준'", () => {
    renderCard(null, () => ({}));
    const card = screen.getByTestId("top-breeder-card");
    expect(card.textContent).toContain("분양왕");
    expect(card.textContent).toContain("분양글 1개로 이번 주 1위");
    expect(screen.getByRole("button", { name: "42점, 점수 기준 보기" })).toBeInTheDocument();
  });

  it("비로그인은 '로그인하면 내 순위가 보여요' 한 줄", () => {
    renderCard(null, () => ({}));
    expect(screen.getByTestId("my-rank-login")).toHaveTextContent("로그인하면 내 순위가 보여요");
  });

  it("로그인: 서버 RankingMe 로 '나는 지금 7위 · 3위까지 글 2개', 점수 줄은 /ranking?focus=me, 글쓰기는 글쓰기 화면", async () => {
    renderCard({ id: 1, name: "초보집사민", avatar: null }, (url) =>
      url.startsWith("/api/rankings/me")
        ? {
            success: true,
            me: { rank: 7, score: 26, delta: null, nextRank: 3, nextScore: 42, nextAction: { kind: "post", count: 2 }, gapToSecond: null },
          }
        : {}
    );
    const row = await screen.findByTestId("my-rank-row");
    expect(row.textContent).toContain("나는 지금 7위 · 3위까지 글 2개");
    expect(screen.getByRole("link", { name: "26점 · 내 순위 ›" })).toHaveAttribute("href", "/ranking?focus=me");
    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute("href", "/posts/upload");
  });

  it("다음 활동이 입찰이면 버튼이 경매로 간다", async () => {
    renderCard({ id: 1, name: "초보집사민", avatar: null }, (url) =>
      url.startsWith("/api/rankings/me")
        ? { rank: 9, score: 6, delta: null, nextRank: 3, nextScore: 30, nextAction: { kind: "bid", count: 4 }, gapToSecond: null }
        : {}
    );
    expect(await screen.findByRole("link", { name: "입찰하기" })).toHaveAttribute("href", "/auctions");
  });

  it("문구 규칙: 1위면 2위와 점수 차, 순위 없음은 첫 활동 안내, 조사 '로/으로'", () => {
    expect(myRankHeadline({ rank: 1, score: 50, delta: null, nextRank: null, nextScore: null, nextAction: null, gapToSecond: 8 })).toEqual({
      lead: "이번 주 ",
      rank: "1위",
      tail: "예요 · 2위와 8점 차이",
    });
    expect(
      myRankHeadline({ rank: null, score: 0, delta: null, nextRank: 3, nextScore: 20, nextAction: { kind: "post", count: 1 }, gapToSecond: null }).tail
    ).toBe("글 1개면 이번 주 순위에 올라요");
    expect(normalizeRankingMe({ success: true, item: { currentRank: 4, score: 10 } })?.rank).toBe(4);
    expect(withRo("분양글 1개")).toBe("분양글 1개로");
    expect(withRo("팔로워 10명")).toBe("팔로워 10명으로");
  });
});
