/**
 * 찬반 토론·라이브 댓글·동네 사랑방 API 계약(앱 docs/prd/live-talk.md §4.2).
 * 앱 src/lib/api/endpoints/liveTalk.ts 가 같은 모양을 쓴다.
 */
import type { DebateSide, DebateSummary } from "./debateFormat";

export type { DebateSide, DebateSummary };

/** 새 클라이언트(앱·웹)가 토론 댓글을 쓸 때 보내는 헤더. 없으면(옛 앱) 투표 없이도 댓글을 받고 stance 는 null. */
export const DEBATE_CLIENT_HEADER = "x-bredy-debate";

/** POST /api/posts 의 토론 입력(category "토론"). */
export interface CreateDebateInput {
  optionA: string;
  optionB: string;
  durationHours: number;
}

/** POST /api/posts/:id/vote */
export interface DebateVoteResult {
  success: boolean;
  debate: DebateSummary;
}

export interface LiveCommentUser {
  id: number;
  name: string;
  avatar: string | null;
}

export interface LiveComment {
  id: number;
  comment: string;
  createdAt: string;
  parentId: number | null;
  /** 답글이면 원댓글 한 줄(인용 줄). */
  parent: { id: number; userName: string; comment: string } | null;
  stance: DebateSide | null;
  isAuthor: boolean;
  likeCount: number;
  isLiked: boolean;
  deleted: boolean;
  user: LiveCommentUser;
}

export interface LiveSwitch {
  userId: number;
  userName: string;
  to: DebateSide;
  at: string;
}

/** GET /api/posts/:id/comments?after=|before=&limit= */
export interface LiveCommentsResult {
  success: boolean;
  comments: LiveComment[];
  switches: LiveSwitch[];
  /** 토론 글이면 요약(막대·참여 수 갱신용), 아니면 null. */
  debate: DebateSummary | null;
  /** decided 토론의 각 쪽 가장 공감받은 댓글(공감 1 이상). */
  best: { A: LiveComment | null; B: LiveComment | null } | null;
  /** before 로 위 페이지를 받을 때 더 있는지. */
  hasMoreBefore: boolean;
}

/** GET /api/debates/home — 홈 '실시간 TOP 토론' 맨 위 카드(없으면 null). */
export interface HomeDebateResult {
  success: boolean;
  post: { id: number; title: string; type: string | null; userId: number; debate: DebateSummary } | null;
}

export interface TownMessageUser {
  id: number;
  name: string;
  avatar: string | null;
  isNewcomer: boolean;
  topSpecies: string | null;
}

export interface TownMessage {
  id: number;
  createdAt: string;
  mine: boolean;
  user: TownMessageUser;
  regionSigungu: string;
  type: "TEXT" | "IMAGE" | "PRODUCT";
  body: string | null;
  image: string | null;
  product: { id: number; name: string; price: number | null; image: string | null; status: string } | null;
  replyTo: { id: number; userName: string; body: string | null } | null;
  deleted: boolean;
  /** 이 범위에서 그 사람의 첫 메시지(새로 온 이웃 줄). */
  firstInScope: boolean;
}

/** GET /api/town/messages?after=|before=&limit= */
export interface TownMessagesResult {
  success: boolean;
  /** 동네 미설정이면 null(입력 막힘, 안내). */
  scope: { label: string; radiusKm: number } | null;
  messages: TownMessage[];
  neighbors: number;
  quietMinutes: number | null;
  prompts: string[];
  hasMoreBefore: boolean;
  /** 내가 이미 반겨 준 사람 id(반겨 주기 버튼을 숨긴다). */
  welcomedUserIds: number[];
}

/** POST /api/town/messages · POST /api/town/welcome 응답. */
export interface TownSendResult {
  success: boolean;
  townMessage: TownMessage;
}

/** GET /api/town/preview — 홈 동네 섹션 사랑방 줄. */
export interface TownPreviewResult {
  success: boolean;
  scope: { label: string } | null;
  messages: TownMessage[];
  empty: boolean;
}
