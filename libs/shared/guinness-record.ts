/** 브리디북 기록값: 소수 첫째 자리로 반올림(앱 formatRecordValue). 89.6329 → "89.6", 84 → "84". */
export function formatRecordValue(value: number): string {
  return Number.isFinite(value) ? (Math.round(value * 10) / 10).toString() : String(value);
}
