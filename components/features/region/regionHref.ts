/**
 * 내 동네 설정 주소. from 은 '완료' 뒤 돌아갈 곳이다 — 로그인을 거쳐 들어오면 뒤로 가기로는 연 곳에 못 돌아간다
 * (뒤 기록이 로그인 처리 화면이다). 로그인 상태에서 링크로 들어오면 RegionPicker 가 뒤로 가므로 쓰지 않아도 된다.
 */
export const regionSettingsHref = (from: string) => `/settings/region?from=${encodeURIComponent(from)}`;
