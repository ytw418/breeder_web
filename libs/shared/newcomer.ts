/**
 * 새 회원 판정(커뮤니티 감사 #20, 2026-10-21 — 앱 시안 design/mockups/author-row/A-karrot.html '새로 왔어요' pill).
 * 가입 NEWCOMER_DAYS 안이면 새 회원이다. 게시글 카드 작성자 줄 pill·관심 분야 '새 회원 첫 글' 알림·
 * 운영자 '아직 댓글이 없는 첫 글' 알림·관리자 '새 회원 첫 글' 필터·동네 사랑방 '새로 온 이웃' 줄이 같은 기준을 쓴다.
 * 웹 breeder_web libs/shared/newcomer.ts = 앱 bredy_app src/lib/newcomer.ts 사본이라 함께 고치고
 * 웹 `npx jest newcomer`·앱 `node --test scripts/test-newcomer.mjs` 로 확인한다.
 */

export const NEWCOMER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 이 시각 이후 가입했으면 새 회원(now - NEWCOMER_DAYS). 서버 조회 조건에 쓴다. */
export function newcomerSince(now: number | Date = Date.now()): Date {
  const time = typeof now === "number" ? now : now.getTime();
  return new Date(time - NEWCOMER_DAYS * DAY_MS);
}

/** 가입 시각이 NEWCOMER_DAYS 안이면 true. 값이 없거나 못 읽으면(옛 서버 응답) false. */
export function isNewcomer(
  createdAt: string | Date | null | undefined,
  now: number | Date = Date.now()
): boolean {
  if (!createdAt) return false;
  const joined = new Date(createdAt).getTime();
  if (Number.isNaN(joined)) return false;
  return joined >= newcomerSince(now).getTime();
}
