import { pickUtmParams, type UtmParams } from "@libs/shared/appLinks";

/**
 * 마지막으로 들어온 유입 캠페인(utm_*)을 이 브라우저에 남긴다(2026-10-22 PostHog UTM 점검).
 * 인스타 링크(`/?utm_source=ig`)로 들어와 다른 화면을 거쳐 /download 에서 플레이스토어를 누를 때
 * 그 캠페인을 설치 리퍼러로 넘기려는 것이다(libs/shared/appLinks.ts playStoreUrlWithReferrer).
 * PostHog 이벤트의 utm 은 posthog-js 가 따로 붙이므로 여기서는 보내지 않는다.
 */
const STORAGE_KEY = "bredy:lastCampaign";
export const CAMPAIGN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { utm: UtmParams; at: number };

/** 주소에 utm 이 있으면 마지막 캠페인으로 덮어쓴다. */
export function rememberCampaign(search: string, now: number = Date.now()) {
  const utm = pickUtmParams(search);
  if (Object.keys(utm).length === 0) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ utm, at: now } satisfies Stored));
  } catch {
    // 저장이 막혀 있으면 지금 주소의 utm 만 쓴다.
  }
}

/** 지금 주소의 utm, 없으면 30일 안에 남긴 마지막 캠페인. */
export function currentCampaign(search: string, now: number = Date.now()): UtmParams {
  const fromUrl = pickUtmParams(search);
  if (Object.keys(fromUrl).length > 0) return fromUrl;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw) as Stored;
    if (!stored || typeof stored.at !== "number" || now - stored.at > CAMPAIGN_TTL_MS) return {};
    return pickUtmParams(new URLSearchParams(stored.utm as Record<string, string>).toString());
  } catch {
    return {};
  }
}
