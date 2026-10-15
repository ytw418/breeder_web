/**
 * 글 속 연락처 가림(동네 사랑방 메시지, 앱 docs/prd/live-talk.md §3.4). 앱 src/lib/contactInText.ts 와 같은 파일 사본이다.
 * 거래 약속은 분양글 채팅에서 하도록, 전화번호·오픈채팅 링크를 저장 전에 가린다.
 * 전화번호는 경매 연락처 가림과 같은 모양("010-****-1234")이다.
 */

const PHONE_PATTERN = /(\+82[\s-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g;
const OPEN_CHAT_PATTERN = /(https?:\/\/)?open\.kakao\.com\/[^\s]+/gi;

function maskPhoneText(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+82") && digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  if (!digits.startsWith("0")) digits = `0${digits}`;
  if (digits.length < 10) return raw;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 전화번호·오픈채팅 링크를 가린 글과 가렸는지 여부. */
export function maskContactsInText(text: string): { text: string; masked: boolean } {
  let masked = false;
  const next = text
    .replace(PHONE_PATTERN, (match) => {
      const out = maskPhoneText(match);
      if (out !== match) masked = true;
      return out;
    })
    .replace(OPEN_CHAT_PATTERN, () => {
      masked = true;
      return "(오픈채팅 링크는 가렸어요)";
    });
  return { text: next, masked };
}
