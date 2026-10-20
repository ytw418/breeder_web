/**
 * 로그인 벽의 이유(reason) → 로그인 화면 제목(2026-10-21 감사 17번 — 이유 없이 전체 화면 로그인이 떠서 그만두던 문제).
 * `/auth/login?next=...&reason=chat` 처럼 넘기면 로그인 화면이 그 이유로 제목을 바꾼다. 모르는 값이면 기존 제목.
 * 앱 bredy_app src/lib/loginReason.ts 와 같은 파일이라 함께 고친다.
 */

export const LOGIN_REASON_TITLES = {
  chat: "로그인하고 분양자와 채팅하기",
  like: "로그인하고 좋아요 남기기",
  fav: "로그인하고 관심 분양글 저장하기",
  follow: "로그인하고 팔로우하기",
  comment: "로그인하고 댓글 남기기",
  bid: "로그인하고 입찰하기",
  write: "로그인하고 글쓰기",
} as const;

export type LoginReason = keyof typeof LOGIN_REASON_TITLES;

/** 쿼리 값을 reason 으로 읽는다. 모르는 값·빈 값은 null. */
export const parseLoginReason = (raw: unknown): LoginReason | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value in LOGIN_REASON_TITLES ? (value as LoginReason) : null;
};

/** reason 이 있으면 그 제목, 없으면 null(화면이 기존 제목을 쓴다). */
export const loginReasonTitle = (raw: unknown): string | null => {
  const reason = parseLoginReason(raw);
  return reason ? LOGIN_REASON_TITLES[reason] : null;
};
