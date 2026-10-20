/**
 * 홈 첫 줄 공지 띠 규칙(앱 docs/prd/home-ia.md S-1 1번, 2026-10-21 커뮤니티 감사 #5).
 * - 앱 `src/lib/noticeBand.ts` 와 같은 파일이다. 고칠 때는 두 곳을 같이 고치고
 *   웹 `npx jest noticeBand` + 앱 `npm run test:notice-band` 로 확인한다.
 * - 플랫폼 import 를 두지 않는다(앱 테스트가 Node 타입 스트리핑으로 돌린다. enum·namespace 금지).
 *
 * 규칙:
 * - 띠에는 최근 14일 안에 올린 공지만 둔다(서버 GET /api/posts/notices?band=1 도 같은 기간만 준다).
 *   없으면 띠를 그리지 않는다(8개월 전 베타 공지가 첫 줄에 남던 문제).
 * - 읽은 공지는 숨긴다: 띠를 눌러 연 공지까지(그 id 이하)와, 상세를 열어 '봄'으로 기록된 공지(unread-marks).
 * - 제목은 앞 '[공지]'·이모지를 떼고 ' · M.D'(한국 날짜)를 붙인다.
 */

export const NOTICE_BAND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface NoticeBandItem {
  id: number;
  title: string;
  createdAt: string | Date;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toMs = (createdAt: string | Date) =>
  createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);

// 그림 이모지·기호 이모지·국기·키캡·이음 문자(ZWJ)·변형 선택자.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** 띠 제목: '[공지] 📢 앱 출시 안내' → '앱 출시 안내 · 10.20'. 날짜를 못 읽으면 제목만. */
export function noticeBandTitle(title: string, createdAt: string | Date): string {
  const clean = title
    .replace(EMOJI_RE, "")
    .replace(/^\s*\[\s*공지\s*\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const ms = toMs(createdAt);
  if (Number.isNaN(ms)) return clean;
  const kst = new Date(ms + KST_OFFSET_MS);
  return `${clean} · ${kst.getUTCMonth() + 1}.${kst.getUTCDate()}`;
}

/**
 * 띠에 보일 공지 하나(최신순 목록의 첫 번째 조건 맞는 것). 없으면 null.
 * seenUpToId: 띠를 눌러 연 공지 id(그 이하 공지는 다 본 것으로 친다). isSeen: 상세를 연 기록(unread-marks).
 */
export function pickBandNotice<T extends NoticeBandItem>(
  notices: readonly T[],
  seen: { seenUpToId: number | null; isSeen: (id: number) => boolean },
  now: number
): T | null {
  for (const notice of notices) {
    const ms = toMs(notice.createdAt);
    if (Number.isNaN(ms) || now - ms > NOTICE_BAND_WINDOW_MS) continue;
    if (seen.seenUpToId != null && notice.id <= seen.seenUpToId) continue;
    if (seen.isSeen(notice.id)) continue;
    return notice;
  }
  return null;
}

/** 저장해 둔 '띠에서 연 공지 id'를 읽는다. 깨졌으면 null. */
export function parseBandSeenId(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : null;
}
