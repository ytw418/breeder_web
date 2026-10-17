/**
 * 웹 광고 설정(앱 docs/prd/ads.md §10). 값이 없으면 그 지면을 그리지 않는다.
 * NEXT_PUBLIC_* 는 빌드 때 점 표기만 바뀌므로 변수마다 그대로 적는다. Vercel 에는 Production 환경에만 넣는다
 * (쿠팡은 테스트 ID 가 없고, AdSense 는 승인된 사이트에서만 광고가 나온다).
 */

/** AdSense 지면. 분양·경매 화면에는 두지 않는다(멸종위기종 거래 콘텐츠 수익화 금지 정책). */
export type AdSensePlacement = "feed" | "postInline" | "postDetail";

export function getAdSenseClient(): string | null {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || null;
}

export function getAdSenseSlot(placement: AdSensePlacement): string | null {
  const value =
    placement === "feed"
      ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED
      : placement === "postInline"
        ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_INLINE
        : process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL;
  return getAdSenseClient() ? value?.trim() || null : null;
}

export type CoupangWebConfig = { bannerId: number; trackingCode: string };

/** 쿠팡 파트너스 다이나믹 배너(앱과 같은 배너). 배너 ID·트래킹 코드가 없으면 null. */
export function getCoupangWebConfig(): CoupangWebConfig | null {
  const bannerId = Number(process.env.NEXT_PUBLIC_COUPANG_BANNER_ID);
  const trackingCode = process.env.NEXT_PUBLIC_COUPANG_TRACKING_CODE?.trim();
  if (!Number.isInteger(bannerId) || bannerId <= 0 || !trackingCode) return null;
  return { bannerId, trackingCode };
}
