import type { role } from "@prisma/client";
import client from "@libs/server/client";

const ADMIN_EMAIL_ALLOWLIST = new Set([
  "ytw418@naver.com",
  "ytw418@gmail.com",
]);

function isWhitelistedAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAIL_ALLOWLIST.has(email.trim().toLowerCase());
}

export function canRunSensitiveAdminAction(email?: string | null) {
  return isWhitelistedAdminEmail(email);
}

/**
 * withAuth 가 채운 req.user 로 관리자 여부를 DB 조회 없이 판별한다.
 * 상세·프로필 목록처럼 매 요청마다 부르는 읽기 API 에서 쓴다.
 */
export function isModeratorUser(
  user?: { role?: role | null; email?: string | null } | null
) {
  if (!user) return false;
  return (
    user.role === "ADMIN" ||
    user.role === "SUPER_USER" ||
    isWhitelistedAdminEmail(user.email)
  );
}

export async function hasAdminAccess(userId?: number) {
  if (!userId) return false;
  const dbUser = await client.user.findUnique({ where: { id: userId } });
  return isModeratorUser(dbUser);
}
