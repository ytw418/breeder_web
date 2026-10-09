import { act, render, screen } from "@testing-library/react";

/**
 * 반려생활 게시글 카드 1안(design/mockups/feed-engagement/A-karrot.html ①):
 * 안 본 글 빨간 점 · 질문 pill · 제목 옆 댓글 수 [N] · 최신 댓글 한 줄 · 답 없는 질문 안내.
 */
const mockUseUser = jest.fn();
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);

import { PostCard, type PostCardData } from "@components/app/PostCard";
import { markItemSeen } from "@libs/client/unreadMarks";

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const basePost: PostCardData = {
  id: 501,
  title: "곤충젤리 어떤 거 쓰세요?",
  description: "요즘 다들 어떤 젤리 쓰시는지 궁금해요.",
  category: "질문",
  createdAt: recent,
  user: { id: 2, name: "사슴벌레아빠" },
  _count: { Likes: 3, comments: 2 },
  latestComment: { id: 9, comment: "고단백 젤리 써요", user: { name: "장수집사" } },
};

beforeEach(() => {
  window.localStorage.clear();
  mockUseUser.mockReturnValue({ user: { id: 7 } });
});

it("질문 pill · 제목 옆 [댓글 수] · 최신 댓글 한 줄, 메타에서는 카테고리·댓글 수를 뺀다", () => {
  render(<PostCard post={basePost} />);
  expect(screen.getByText("질문")).toBeInTheDocument();
  expect(screen.getByText("[2]")).toBeInTheDocument();
  expect(screen.getByText("장수집사")).toBeInTheDocument();
  expect(screen.getByText("고단백 젤리 써요")).toBeInTheDocument();
  expect(screen.getByText(/사슴벌레아빠/).textContent).toBe("사슴벌레아빠");
  expect(screen.getByText(/좋아요 3/).textContent).not.toContain("댓글");
});

it("답이 없는 질문은 '아직 답변이 없어요' 안내", () => {
  render(
    <PostCard
      post={{ ...basePost, _count: { Likes: 0, comments: 0 }, latestComment: null }}
    />
  );
  expect(screen.getByText("아직 답변이 없어요 · 첫 답변을 남겨 주세요")).toBeInTheDocument();
  expect(screen.queryByText("[0]")).toBeNull();
});

it("안 본 최근 글엔 빨간 점, 상세를 열어 기록되면 사라진다", () => {
  render(<PostCard post={basePost} />);
  expect(screen.getByLabelText("안 본 글")).toBeInTheDocument();
  act(() => markItemSeen("post", { id: 501, createdAt: recent }));
  expect(screen.queryByLabelText("안 본 글")).toBeNull();
});

it("내가 쓴 글과 7일 지난 글엔 점이 없다", () => {
  mockUseUser.mockReturnValue({ user: { id: 2 } });
  const { unmount } = render(<PostCard post={basePost} />);
  expect(screen.queryByLabelText("안 본 글")).toBeNull();
  unmount();

  mockUseUser.mockReturnValue({ user: { id: 7 } });
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  render(<PostCard post={{ ...basePost, id: 502, createdAt: old }} />);
  expect(screen.queryByLabelText("안 본 글")).toBeNull();
});
