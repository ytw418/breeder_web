/**
 * 글 속 연락처 가림·감지. 앱 src/lib/contactInText.ts 와 같은 파일 사본이다(함께 고친다).
 * - 가림(maskContactsInText): 동네 사랑방 메시지(앱 docs/prd/live-talk.md §3.4). 거래 약속은 분양글 채팅에서 하도록
 *   전화번호·계좌번호·오픈채팅 링크를 저장 전에 가린다. 전화번호는 경매 연락처 가림과 같은 모양("010-****-1234")이다.
 * - 감지(detectRiskyContact): 1:1 채팅은 가리지 않고, 받은 메시지에 계좌·오픈채팅·카톡 아이디가 있으면
 *   받는 사람에게만 주의 줄을 붙인다(2026-10-21 감사 24번, 앱 docs/prd/chat.md).
 */

const PHONE_PATTERN = /(\+82[\s-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g;
const OPEN_CHAT_PATTERN = /(https?:\/\/)?open\.kakao\.com\/[^\s]+/gi;
/** "카톡 아이디: abc", "카카오톡 ID abc" 같은 외부 메신저 아이디 안내. */
const KAKAO_ID_PATTERN = /(카톡|카카오톡)\s*(아이디|id)\s*[:：]?\s*\S+/i;
/** 계좌번호 후보: 숫자·하이픈 묶음(숫자 10~14자리). 은행 이름이 앞뒤 30자 안에 있어야 계좌로 본다. */
const ACCOUNT_DIGITS_PATTERN = /\d[\d-]{8,22}\d/g;
const ACCOUNT_CONTEXT_CHARS = 30;
const BANK_NAME_PATTERN =
  /(은행|계좌|국민|신한|우리|하나|농협|기업|카카오뱅크|카뱅|토스|케이뱅크|새마을|우체국|수협|신협|제일|씨티|부산|경남|대구|광주|전북|제주|산업|저축|KB|NH|IBK|SC|iM뱅크)/;
/** 휴대폰 번호(01X 로 시작하는 10~11자리)는 계좌로 보지 않는다. */
const MOBILE_DIGITS_PATTERN = /^01[016789]\d{7,8}$/;

function maskPhoneText(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+82") && digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  if (!digits.startsWith("0")) digits = `0${digits}`;
  if (digits.length < 10) return raw;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 은행 이름이 가까이 있는 계좌번호 묶음의 [시작, 끝) 위치들. */
function findAccountRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  // exec 반복(for-of matchAll 은 jest·구형 변환 대상에서 돌지 않는다). 공유 정규식의 lastIndex 를 건드리지 않게 새로 만든다.
  const pattern = new RegExp(ACCOUNT_DIGITS_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    const digits = raw.replace(/-/g, "");
    if (raw.includes("--") || digits.length < 10 || digits.length > 14) continue;
    if (MOBILE_DIGITS_PATTERN.test(digits)) continue;
    const around =
      text.slice(Math.max(0, start - ACCOUNT_CONTEXT_CHARS), start) +
      " " +
      text.slice(end, end + ACCOUNT_CONTEXT_CHARS);
    if (BANK_NAME_PATTERN.test(around)) ranges.push([start, end]);
  }
  return ranges;
}

function maskAccounts(text: string): { text: string; masked: boolean } {
  const ranges = findAccountRanges(text);
  if (ranges.length === 0) return { text, masked: false };
  let out = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    out += `${text.slice(cursor, start)}(계좌번호는 가렸어요)`;
    cursor = end;
  }
  return { text: out + text.slice(cursor), masked: true };
}

/** 전화번호·계좌번호·오픈채팅 링크를 가린 글과 가렸는지 여부. */
export function maskContactsInText(text: string): { text: string; masked: boolean } {
  // 계좌를 먼저 가린다. 전화번호 패턴이 계좌번호 일부를 전화번호로 잘못 가리지 않게 하려는 것이다.
  const account = maskAccounts(text);
  let masked = account.masked;
  const next = account.text
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

/** 채팅방 맨 위 사기 주의 카드(1:1 방, 방별로 닫힘)·받은 말풍선 주의 줄 문구. */
export const CHAT_SCAM_NOTICE_TITLE = "선입금만 요구하거나 카톡·오픈채팅으로 옮기자고 하면 사기일 수 있어요";
export const CHAT_SCAM_NOTICE_SUB = "브리디 운영팀은 입금을 요구하지 않아요";
export const CHAT_CONTACT_CAUTION = "계좌·외부 메신저 안내가 포함된 메시지예요 · 선입금은 조심하세요";

export interface RiskyContact {
  /** 은행 이름 가까이 있는 계좌번호 */
  account: boolean;
  /** 카카오 오픈채팅 링크 */
  openChat: boolean;
  /** 카톡 아이디 안내 */
  kakaoId: boolean;
}

/** 글에 계좌·오픈채팅·카톡 아이디가 있는지. 채팅 받은 말풍선 주의 줄에 쓴다. */
export function detectRiskyContact(text: string | null | undefined): RiskyContact {
  const value = text ?? "";
  return {
    account: findAccountRanges(value).length > 0,
    // search 는 g 플래그의 lastIndex 를 쓰지 않는다.
    openChat: value.search(OPEN_CHAT_PATTERN) >= 0,
    kakaoId: KAKAO_ID_PATTERN.test(value),
  };
}

/** 셋 중 하나라도 있으면 true. */
export function hasRiskyContact(text: string | null | undefined): boolean {
  const risky = detectRiskyContact(text);
  return risky.account || risky.openChat || risky.kakaoId;
}
