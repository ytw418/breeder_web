import { isReservedUserName } from "@libs/shared/deletedUser";
import { hasBlockedWord } from "@libs/shared/contentFilter";

/**
 * 닉네임 형식 규칙(웹·앱·서버 공통). 중복 여부는 DB 가 필요해 libs/server/nickname.ts 에서 판정한다.
 * 길이는 클라이언트 입력 제한과 같게 JS 문자열 길이로 센다.
 */
export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_TAKEN_MESSAGE = "중복된 닉네임입니다.";
/** 닉네임을 바꾼 뒤 다시 바꿀 수 있기까지(노쇼 뒤 이름만 바꿔 숨는 것을 막는다, 커뮤니티 감사 #13). 앱·웹 프로필 수정 안내 줄과 같은 값. */
export const NICKNAME_CHANGE_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NicknameRejectCode = "EMPTY" | "TOO_LONG" | "RESERVED" | "TAKEN";

export type NicknameValidation =
  | { ok: true; name: string }
  | { ok: false; code: Exclude<NicknameRejectCode, "TAKEN">; reason: string };

const REJECT_REASONS: Record<Exclude<NicknameRejectCode, "TAKEN">, string> = {
  EMPTY: "닉네임을 입력해주세요.",
  TOO_LONG: `닉네임은 최대 ${NICKNAME_MAX_LENGTH}글자까지 입력할 수 있어요.`,
  RESERVED: "사용할 수 없는 닉네임입니다.",
};

const reject = (
  code: Exclude<NicknameRejectCode, "TAKEN">
): NicknameValidation => ({ ok: false, code, reason: REJECT_REASONS[code] });

/**
 * 운영자 사칭에 쓰이는 낱말(2026-10-21 커뮤니티 감사 #13). 닉네임 어디에든 들어 있으면 막는다.
 * 비교는 소문자·공백·'.'·'_'를 지운 모양으로 하므로 여기도 그 모양으로 적는다.
 */
const IMPERSONATION_WORDS = ["브리디", "bredy", "브레디", "운영", "관리자", "admin", "공식", "고객센터"] as const;

/** 공백(NBSP·전각 포함)·0폭 문자·한글 채움 문자처럼 보이지 않는 문자와 구분 기호 '.'·'_'·'-'·'·'(NFKC 뒤라 전각도 여기서 걸린다). */
const IMPERSONATION_IGNORED = /[\s._\-·\u00AD\u034F\u115F\u1160\u180E\u200B-\u200F\u2060-\u2064\u3164\uFEFF\uFFA0]/g;

/** 운영자를 사칭하는 닉네임인지. 'Ｂｒｅｄｙ'(전각)·'브리디 운영팀'·'bredy_official' 같은 변형도 잡도록 NFKC 정규화 뒤 비교한다. */
export function isImpersonatingNickname(name: string): boolean {
  const key = name.normalize("NFKC").replace(IMPERSONATION_IGNORED, "").toLowerCase();
  return IMPERSONATION_WORDS.some((word) => key.includes(word));
}

/**
 * 앞뒤 공백을 지운 뒤 길이·예약어·금칙어를 검사한다.
 * allowReserved: 운영자 이메일 계정(서버 checkNickname 이 판단)은 운영자 낱말을 쓸 수 있다.
 */
export function validateNickname(
  raw: unknown,
  { allowReserved = false }: { allowReserved?: boolean } = {}
): NicknameValidation {
  const name = raw == null ? "" : String(raw).trim();
  if (name.length < NICKNAME_MIN_LENGTH) return reject("EMPTY");
  if (name.length > NICKNAME_MAX_LENGTH) return reject("TOO_LONG");
  // 탈퇴 유저 표시용 이름("탈퇴한 사용자…")은 사칭 방지를 위해 막는다.
  if (isReservedUserName(name)) return reject("RESERVED");
  if (!allowReserved && isImpersonatingNickname(name)) return reject("RESERVED");
  // 욕설·비하어도 같은 문구로 거절한다(어떤 낱말인지 알려 주지 않는다).
  if (hasBlockedWord(name)) return reject("RESERVED");
  return { ok: true, name };
}

/**
 * 다음에 닉네임을 바꿀 수 있는 시각. 아직 한 번도 안 바꿨으면(가입 때 받은 무작위 이름) null — 바로 바꿀 수 있다.
 * 이 시각이 지금보다 뒤면 바꿀 수 없다.
 */
export function nextNicknameChangeAt(nameChangedAt: Date | null | undefined): Date | null {
  if (!nameChangedAt) return null;
  return new Date(nameChangedAt.getTime() + NICKNAME_CHANGE_COOLDOWN_DAYS * DAY_MS);
}

/**
 * 두 닉네임이 같은지(앞뒤 공백·유니코드 조합 차이만 무시). 혈통 보내기에서 toUserId 로 찾은 사람과
 * 함께 온 toUserName(링크로 미리 채운 닉네임 등)이 같은 사람인지 확인할 때 쓴다.
 */
export function isSameNickname(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").normalize("NFC").trim();
  const right = (b ?? "").normalize("NFC").trim();
  return left.length > 0 && left === right;
}
