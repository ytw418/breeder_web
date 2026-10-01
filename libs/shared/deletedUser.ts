/**
 * 탈퇴 유저 표시 규칙. 서버는 name 을 "탈퇴한 사용자#<id>" 로 바꿔 unique 를 지키고,
 * 클라이언트는 접미사를 떼고 "탈퇴한 사용자" 로만 보여준다.
 */
export const DELETED_USER_PREFIX = "탈퇴한 사용자#";
export const DELETED_USER_LABEL = "탈퇴한 사용자";

export const buildDeletedUserName = (userId: number) =>
  `${DELETED_USER_PREFIX}${userId}`;

export const isDeletedUserName = (name?: string | null) =>
  Boolean(name && name.startsWith(DELETED_USER_PREFIX));

/**
 * 공백·0폭 문자·한글 채움 문자처럼 화면에서 보이지 않거나 공백으로 보이는 문자.
 * (NBSP·전각 공백 등은 \s 에 포함된다.)
 */
const INVISIBLE_OR_SPACE = /[\s\u00AD\u034F\u115F\u1160\u180E\u200B-\u200F\u2060-\u2064\u3164\uFEFF\uFFA0]/g;
const RESERVED_NAME_KEY = DELETED_USER_LABEL.replace(INVISIBLE_OR_SPACE, "");

/**
 * 사칭 방지: 일반 유저는 "탈퇴한 사용자" 로 시작하는 닉네임을 쓸 수 없다.
 * 다른 공백(NBSP·전각)·연속 공백·0폭 문자를 끼워 같은 모양을 만드는 변형도 막도록
 * 호환 정규화(NFKC) 후 보이지 않는 문자를 모두 지우고 비교한다.
 */
export const isReservedUserName = (name?: string | null) =>
  Boolean(
    name &&
      name.normalize("NFKC").replace(INVISIBLE_OR_SPACE, "").startsWith(RESERVED_NAME_KEY)
  );

export const displayUserName = (name?: string | null) =>
  isDeletedUserName(name) ? DELETED_USER_LABEL : name ?? "";

const DELETED_USER_NAME = /^탈퇴한 사용자#\d+$/;

/**
 * API 응답 전체에서 `name: "탈퇴한 사용자#<id>"` 만 골라 표시용 라벨로 바꾼다(제자리 변경).
 * 이름을 그리는 화면이 많아 응답을 받는 한 곳(SWR fetcher·useMutation·fetcher, SSR 초기 데이터)에서 처리한다.
 * 앱 src/lib/user/displayName.ts 와 같은 규칙.
 */
export function normalizeDeletedUserNames<T>(value: T): T {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = normalizeDeletedUserNames(value[i]);
    }
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const field = record[key];
      if (key === "name" && typeof field === "string" && DELETED_USER_NAME.test(field)) {
        record[key] = DELETED_USER_LABEL;
      } else if (field && typeof field === "object") {
        normalizeDeletedUserNames(field);
      }
    }
  }
  return value;
}
