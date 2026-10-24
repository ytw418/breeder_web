/**
 * 운영자 이메일 판별. 정확히 아래 두 메일함만 운영자다.
 * 2026-10-12 에는 '아이디가 ytw418 로 시작'이었는데, 카카오는 아무 도메인 이메일로 가입할 수 있어
 * `ytw418abc@아무도메인` 계정이 운영자 권한(회원 제재·남의 글 삭제)을 얻었다 — 2026-10-24 보안 점검에서 허용 목록으로 바꿨다.
 * gmail 의 `ytw418+별칭@gmail.com` 은 같은 메일함으로 가서 계속 허용한다.
 * 서버(libs/server/adminAccess)와 웹 관리자 화면이 같이 쓴다.
 */
export const ADMIN_EMAIL_ID_PREFIX = "ytw418";

const ADMIN_EMAILS = new Set(["ytw418@gmail.com", "ytw418@naver.com"]);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return false;
  const domain = normalized.slice(at + 1);
  const id = normalized.slice(0, at);
  const baseId = domain === "gmail.com" ? id.split("+")[0] : id;
  return ADMIN_EMAILS.has(`${baseId}@${domain}`);
}
