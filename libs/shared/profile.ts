/**
 * 프로필 사진형(A안) 공통 규칙. 앱 docs/prd/profile.md 와 같은 값을 쓴다.
 */

/** 소개 최대 글자 수(코드포인트 기준 — 이모지 1개 = 1자). */
export const BIO_MAX = 150;
/** 프로필 사진 그리드 맨 앞에 고정할 수 있는 게시글 수. */
export const PROFILE_PIN_MAX = 3;

export const BIO_TOO_LONG_MESSAGE = `소개는 ${BIO_MAX}자까지 쓸 수 있어요.`;
export const BIO_INVALID_MESSAGE = "소개 값이 올바르지 않습니다.";
export const PROFILE_PIN_LIMIT_MESSAGE = `프로필 고정은 ${PROFILE_PIN_MAX}개까지 할 수 있어요.`;
export const POST_NOT_PINNABLE_MESSAGE = "사진이 있는 내 게시글만 프로필에 고정할 수 있어요.";

export type NormalizeBioResult =
  | { ok: true; bio: string | null }
  | { ok: false; errorCode: "BIO_TOO_LONG" | "BIO_INVALID"; message: string };

/**
 * 저장할 소개 값으로 정규화한다.
 * - null·빈 문자열(공백만)은 null(소개 지우기).
 * - 앞뒤 공백을 지우고, 줄 끝 공백을 지우고, 빈 줄이 2개 넘게 이어지면 1개로 줄인다(연속 개행 3개 이상 → 2개).
 * - 정규화 뒤 코드포인트 BIO_MAX 자를 넘으면 거부한다.
 */
export function normalizeBio(input: unknown): NormalizeBioResult {
  if (input === null || input === undefined) return { ok: true, bio: null };
  if (typeof input !== "string") {
    return { ok: false, errorCode: "BIO_INVALID", message: BIO_INVALID_MESSAGE };
  }
  const bio = input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!bio) return { ok: true, bio: null };
  if (Array.from(bio).length > BIO_MAX) {
    return { ok: false, errorCode: "BIO_TOO_LONG", message: BIO_TOO_LONG_MESSAGE };
  }
  return { ok: true, bio };
}

/** 사용자 앨범(앱 docs/prd/profile.md F-9). */
export const ALBUM_MAX = 10;
export const ALBUM_POST_MAX = 30;
export const ALBUM_TITLE_MAX = 12;

export const ALBUM_LIMIT_MESSAGE = `앨범은 ${ALBUM_MAX}개까지 만들 수 있어요.`;
export const ALBUM_TITLE_INVALID_MESSAGE = `앨범 이름은 1~${ALBUM_TITLE_MAX}자로 적어 주세요.`;
export const ALBUM_POSTS_INVALID_MESSAGE = `앨범에는 사진이 있는 내 게시글을 1~${ALBUM_POST_MAX}개 넣을 수 있어요.`;
export const ALBUM_NOT_FOUND_MESSAGE = "앨범을 찾을 수 없어요.";
export const NOT_ALBUM_OWNER_MESSAGE = "내 앨범만 고칠 수 있어요.";

/** 앨범 이름: 공백을 하나로 접고 앞뒤를 지운 뒤 코드포인트 1~12자. 아니면 null. */
export function normalizeAlbumTitle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const title = input.replace(/\s+/g, " ").trim();
  const length = Array.from(title).length;
  return length >= 1 && length <= ALBUM_TITLE_MAX ? title : null;
}

/** 앨범 글 id 목록: 정수만, 처음 나온 순서를 지켜 중복을 뺀다. 형식이 틀리면 null. */
export function normalizeAlbumPostIds(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null;
  const ids: number[] = [];
  for (const value of input) {
    if (!Number.isInteger(value) || (value as number) <= 0) return null;
    if (!ids.includes(value as number)) ids.push(value as number);
  }
  return ids;
}
