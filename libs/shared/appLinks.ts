/** 스토어 주소(2026-10-20 출시 확인). 앱스토어 id 는 App Store Connect 앱 6822154153, 플레이는 패키지 app.bredy.mobile. */
export const APP_STORE_URL = "https://apps.apple.com/kr/app/id6822154153";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.bredy.mobile";
export const DOWNLOAD_PAGE_PATH = "/download";

/** posthog-js 가 이벤트에 붙이는 캠페인 키(앱 src/lib/analytics-core.ts UTM_KEYS 와 같다). */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;
const UTM_VALUE_MAX = 200;

/** 웹을 거쳐 설치했지만 들어온 캠페인이 없을 때 플레이 리퍼러에 넣는 값. 스토어에서 바로 받은 사람(google-play/organic)과 나눈다. */
export const WEB_DEFAULT_REFERRER: UtmParams = { utm_source: "bredy_web", utm_medium: "download_page" };

/** `?utm_source=ig&x=1` 같은 쿼리 문자열에서 utm_* 만 꺼낸다. 키는 소문자로 맞추고 빈 값은 버린다. */
export function pickUtmParams(search: string | null | undefined): UtmParams {
  const result: UtmParams = {};
  if (!search) return result;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.forEach((value, rawKey) => {
    const key = rawKey.toLowerCase();
    if (!(UTM_KEYS as readonly string[]).includes(key)) return;
    const trimmed = value.trim().slice(0, UTM_VALUE_MAX);
    if (trimmed) result[key as keyof UtmParams] = trimmed;
  });
  return result;
}

/**
 * 플레이스토어 주소에 설치 리퍼러를 붙인다. 앱은 첫 실행 때 이 값을 읽어 PostHog `Application Installed` 에 남긴다
 * (앱 src/lib/analytics.ts readInstallReferrer). 캠페인이 없으면 WEB_DEFAULT_REFERRER.
 * 앱스토어는 설치 리퍼러를 앱에 넘기지 않아 그대로 둔다.
 */
export function playStoreUrlWithReferrer(utm: UtmParams): string {
  const source = Object.keys(utm).length > 0 ? utm : WEB_DEFAULT_REFERRER;
  const referrer = new URLSearchParams(source as Record<string, string>).toString();
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
}
