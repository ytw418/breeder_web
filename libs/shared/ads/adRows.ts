/**
 * 목록 사이 광고 행 규칙(docs/prd/ads.md). 웹 breeder_web libs/shared/ads/adRows.ts 와 같은 파일이라 함께 고치고
 * 앱 `npm run test:ad-rows`·웹 jest 로 확인한다.
 */

/** 목록에서 콘텐츠 행 몇 개마다 광고 행 하나를 끼우는지. */
export const AD_INTERVAL = 8;

export type AdRow = { kind: "ad"; slot: number };

/**
 * 목록 행 사이에 interval 개마다 광고 행을 끼운다. 마지막 행 뒤에는 붙이지 않아 목록 끝에 광고가 매달리지 않는다.
 * 슬롯 번호는 위치로 정해져 다음 페이지가 붙어도 앞의 광고 행이 그대로다.
 */
export function withAdRows<T>(
  rows: readonly T[],
  enabled: boolean,
  interval = AD_INTERVAL,
): (T | AdRow)[] {
  if (!enabled) return rows.slice();
  return rows.flatMap((row, index) => {
    const count = index + 1;
    return count % interval === 0 && count < rows.length
      ? [row, { kind: "ad" as const, slot: count / interval - 1 }]
      : [row];
  });
}
