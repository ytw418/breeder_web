/**
 * 프로필 사진형(A안) 공통 규칙. 앱 docs/prd/profile.md 와 같은 값을 쓴다.
 */

/** 소개 최대 글자 수(코드포인트 기준 — 이모지 1개 = 1자). v5 에서 150 → 300. DB 는 TEXT 라 숫자만 바꾸면 늘릴 수 있다. */
export const BIO_MAX = 300;
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
    return {
      ok: false,
      errorCode: "BIO_INVALID",
      message: BIO_INVALID_MESSAGE,
    };
  }
  const bio = input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!bio) return { ok: true, bio: null };
  if (Array.from(bio).length > BIO_MAX) {
    return {
      ok: false,
      errorCode: "BIO_TOO_LONG",
      message: BIO_TOO_LONG_MESSAGE,
    };
  }
  return { ok: true, bio };
}

/** 대표 링크 최대 길이(프로필 v5, 앱 docs/prd/profile.md). */
export const PROFILE_LINK_MAX = 300;
/** 링크 표시 문구 최대 글자 수(말줄임표 포함). */
const PROFILE_LINK_LABEL_MAX = 40;

export const LINK_INVALID_MESSAGE = "링크 주소가 올바르지 않아요. https:// 로 시작하는 주소를 적어 주세요.";
export const LINK_TOO_LONG_MESSAGE = `링크는 ${PROFILE_LINK_MAX}자까지 쓸 수 있어요.`;
export const BANNER_INVALID_MESSAGE = "배너 이미지 값이 올바르지 않습니다.";

export type NormalizeProfileLinkResult =
  | { ok: true; link: string | null }
  | { ok: false; errorCode: "LINK_INVALID" | "LINK_TOO_LONG"; message: string };

/**
 * 저장할 대표 링크로 정규화한다.
 * - null·빈 문자열(공백만)은 null(링크 지우기).
 * - 스킴이 없으면 https:// 를 붙인다. http/https 만 받는다(javascript: 등 차단).
 * - 점이 들어간 호스트만, 공백·자격 증명(user:pw@)·호스트의 한글 자모는 거부한다.
 */
export function normalizeProfileLink(input: unknown): NormalizeProfileLinkResult {
  const invalid = {
    ok: false as const,
    errorCode: "LINK_INVALID" as const,
    message: LINK_INVALID_MESSAGE,
  };
  if (input === null || input === undefined) return { ok: true, link: null };
  if (typeof input !== "string") return invalid;
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, link: null };
  if (/\s/.test(trimmed)) return invalid;
  // 한글 키보드 상태로 친 주소(ㅆㅐㅕ셔ㅠㄷ.채ㅡ)는 URL 파서가 받아 주지만 실제 도메인이 아니다. 완성형 한글 도메인은 받는다.
  const rawHost = trimmed.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  if (/[\u1100-\u11FF\u3131-\u318E]/.test(rawHost)) return invalid;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return invalid;
  const link = hasScheme ? trimmed : `https://${trimmed}`;
  if (link.length > PROFILE_LINK_MAX) {
    return {
      ok: false,
      errorCode: "LINK_TOO_LONG",
      message: LINK_TOO_LONG_MESSAGE,
    };
  }
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return invalid;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return invalid;
  if (url.username || url.password) return invalid;
  if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return invalid;
  return { ok: true, link };
}

/** 프로필에 보여 줄 링크 문구: 스킴·www·끝 슬래시를 빼고 40자를 넘으면 말줄임표. */
export function profileLinkLabel(link: string): string {
  const label = link
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
  const chars = Array.from(label);
  return chars.length > PROFILE_LINK_LABEL_MAX ? `${chars.slice(0, PROFILE_LINK_LABEL_MAX - 1).join("")}…` : label;
}

export type NormalizeProfileBannerResult =
  | { ok: true; banner: string | null }
  | { ok: false; errorCode: "BANNER_INVALID"; message: string };

/** 커버 이미지 Cloudflare id. null·빈 값은 지우기, 영문·숫자·-·_ 1~100자만 받는다. */
export function normalizeProfileBanner(input: unknown): NormalizeProfileBannerResult {
  if (input === null || input === undefined || input === "") return { ok: true, banner: null };
  if (typeof input !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(input)) {
    return {
      ok: false,
      errorCode: "BANNER_INVALID",
      message: BANNER_INVALID_MESSAGE,
    };
  }
  return { ok: true, banner: input };
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
