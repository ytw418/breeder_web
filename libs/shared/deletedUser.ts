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

export const displayUserName = (name?: string | null) =>
  isDeletedUserName(name) ? DELETED_USER_LABEL : name ?? "";
