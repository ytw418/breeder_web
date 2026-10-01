import { isReservedUserName } from "@libs/shared/deletedUser";

/**
 * 닉네임 형식 규칙(웹·앱·서버 공통). 중복 여부는 DB 가 필요해 libs/server/nickname.ts 에서 판정한다.
 * 길이는 클라이언트 입력 제한과 같게 JS 문자열 길이로 센다.
 */
export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_TAKEN_MESSAGE = "중복된 닉네임입니다.";

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

/** 앞뒤 공백을 지운 뒤 길이·예약어를 검사한다. */
export function validateNickname(raw: unknown): NicknameValidation {
  const name = raw == null ? "" : String(raw).trim();
  if (name.length < NICKNAME_MIN_LENGTH) return reject("EMPTY");
  if (name.length > NICKNAME_MAX_LENGTH) return reject("TOO_LONG");
  // 탈퇴 유저 표시용 이름("탈퇴한 사용자…")은 사칭 방지를 위해 막는다.
  if (isReservedUserName(name)) return reject("RESERVED");
  return { ok: true, name };
}
