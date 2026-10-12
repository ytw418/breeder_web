/**
 * 운영자 이메일 판별. 아이디(@ 앞)가 `ytw418` 로 시작하면 운영자다(2026-10-12 사용자 결정).
 * 예: ytw418@gmail.com, ytw418@naver.com. 서버(libs/server/adminAccess)와 웹 관리자 화면이 같이 쓴다.
 * 앱 사본: bredy_app/src/lib/adminEmail.ts
 */
export const ADMIN_EMAIL_ID_PREFIX = "ytw418";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return false;
  return normalized.slice(0, at).startsWith(ADMIN_EMAIL_ID_PREFIX);
}
