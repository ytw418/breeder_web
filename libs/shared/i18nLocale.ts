/**
 * 다국어 언어 결정 규칙(docs/prd/i18n.md §3.1·§3.2).
 * 앱 src/lib/i18nLocale.ts = 웹 libs/shared/i18nLocale.ts 사본이라 두 저장소를 같이 고친다
 * (앱 `node --test scripts/test-i18n-locale.mjs`, 웹 jest `__tests__/i18nLocale.test.ts`).
 */

/** 번역 파일이 있는 언어. 서버가 `User.locale` 로 받아 주는 값도 이 목록이다. */
export const SUPPORTED_LOCALES = ["ko", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "ko";

/**
 * 실제로 화면에 켜는 언어. 셸 문구 이전(PRD I-5)이 끝나기 전에는 영어를 켜지 않는다(PRD §8) —
 * 지금 영어를 켜면 번역한 몇 줄만 영어이고 나머지는 한국어로 섞여 보인다.
 */
export const ACTIVE_LOCALES: readonly AppLocale[] = ["ko"];

/** 지원하지 않는 언어(fr 등)만 있을 때 한국어보다 먼저 고르는 언어 */
const SECONDARY_FALLBACK: AppLocale = "en";

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** "en-US"·"ko_KR"·"EN" 같은 언어 태그를 `locales` 중 하나로 맞춘다. 못 맞추면 null. */
export function matchLocale(
  tag: string | null | undefined,
  locales: readonly AppLocale[] = ACTIVE_LOCALES,
): AppLocale | null {
  if (!tag) return null;
  const normalized = tag.trim().replace(/_/g, "-").toLowerCase();
  if (!normalized) return null;
  const exact = locales.find((l) => l.toLowerCase() === normalized);
  if (exact) return exact;
  const primary = normalized.split("-")[0];
  return locales.find((l) => l.toLowerCase().split("-")[0] === primary) ?? null;
}

type ResolveLocaleInput = {
  /** 로그인 사용자의 `User.locale` */
  account?: string | null;
  /** 기기(앱 SecureStore)·브라우저(쿠키 `bredy_locale`)에 저장한 선택값 */
  saved?: string | null;
  /** 기기·브라우저 언어 목록(선호 순서) */
  device?: readonly string[] | string | null;
  /** 고를 수 있는 언어. 기본은 지금 켠 언어(ACTIVE_LOCALES) */
  locales?: readonly AppLocale[];
};

/**
 * 결정 순서: 계정 → 저장한 선택 → 기기·브라우저 언어 → 한국어.
 * 기기 언어가 있는데 하나도 맞지 않으면(fr 등) 영어가 켜져 있을 때만 영어, 아니면 한국어.
 */
export function resolveLocale({
  account,
  saved,
  device,
  locales = ACTIVE_LOCALES,
}: ResolveLocaleInput): AppLocale {
  const fromAccount = matchLocale(account, locales);
  if (fromAccount) return fromAccount;
  const fromSaved = matchLocale(saved, locales);
  if (fromSaved) return fromSaved;

  const deviceTags = (Array.isArray(device) ? device : device ? [device] : []).filter(Boolean);
  for (const tag of deviceTags) {
    const matched = matchLocale(tag, locales);
    if (matched) return matched;
  }
  if (deviceTags.length > 0 && locales.includes(SECONDARY_FALLBACK)) return SECONDARY_FALLBACK;
  return locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : (locales[0] ?? DEFAULT_LOCALE);
}

/** `Accept-Language` 헤더를 선호 순서(q 높은 순) 언어 태그 목록으로 바꾼다. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.tag);
}
