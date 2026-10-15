/**
 * 금칙어 검사(앱 docs/prd/live-talk.md §4.4). 앱 src/lib/contentFilter.ts 와 같은 파일 사본이다.
 * 토론 질문·선택지·설명·토론 댓글·사랑방 메시지에 쓴다. 앱·웹이 보내기 전에, 서버가 저장 전에 같은 함수로 검사한다.
 * 띄어쓰기·특수문자를 끼워 넣어도 잡히게 공백·기호를 지운 뒤 포함 여부를 본다.
 * 정상 낱말(시발점 등)을 막지 않도록 허용 목록을 먼저 지운다.
 */

/** 막는 말(욕설·비하어). 너무 넓게 잡으면 일상 대화가 막히니 분명한 것만 둔다. */
const BLOCKED_WORDS = [
  "씨발",
  "시발",
  "씨바",
  "ㅅㅂ",
  "ㅆㅂ",
  "병신",
  "ㅂㅅ",
  "븅신",
  "개새끼",
  "개새기",
  "개색기",
  "새끼야",
  "좆",
  "존나게",
  "지랄",
  "ㅈㄹ",
  "느금",
  "니애미",
  "니미럴",
  "애미뒤",
  "엠창",
  "미친년",
  "미친놈",
  "썅",
  "닥쳐",
  "꺼져라",
  "죽어라",
] as const;

/** 막는 말이 들어 있어도 정상인 낱말. 검사 전에 지운다. */
const ALLOWED_WORDS = ["시발점", "시발역", "시발택시"] as const;

export const BLOCKED_WORD_MESSAGE = "고운 말로 다시 써 주세요";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\s​.,!?~·•\-_=+*/\\|'"`^()[\]{}<>@#$%&:;0-9]/g, "");

/** 막는 말이 있으면 그 말, 없으면 null. */
export function findBlockedWord(text: string | null | undefined): string | null {
  if (!text) return null;
  let normalized = normalize(text);
  for (const allowed of ALLOWED_WORDS) normalized = normalized.split(allowed).join("");
  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) return word;
  }
  return null;
}

export const hasBlockedWord = (text: string | null | undefined) => findBlockedWord(text) !== null;
