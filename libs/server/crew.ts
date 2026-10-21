/**
 * 브레디 크루(운영 계정) 판정. 분석에서 크루 활동을 사람 활동과 나눠 보려고 /api/users/me 가 isCrew 를 내려주고,
 * 웹·앱은 PostHog identify 때 is_crew 속성으로 붙인다(2026-10-21 감사 16번).
 *
 * - 운영 크루 50명은 user id 99~148 이다(2026-10-19 기준, scripts/crew/crew.mjs setup 으로 만듦).
 * - 크루는 이메일이 없고(테스트 계정 API 로 만든다) 이름 끝에 '·크루' 를 단다. dev 처럼 id 가 다른 DB 에서도 이 꼬리로 판정한다.
 */
export const CREW_USER_ID_MIN = 99;
export const CREW_USER_ID_MAX = 148;
export const CREW_NAME_SUFFIX = "·크루";

export function isCrewUser(user: { id: number; name?: string | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.id >= CREW_USER_ID_MIN && user.id <= CREW_USER_ID_MAX) return true;
  return typeof user.name === "string" && user.name.endsWith(CREW_NAME_SUFFIX);
}
