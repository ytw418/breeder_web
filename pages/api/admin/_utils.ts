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

export async function hasAdminAccess(userId?: number) {
  if (!userId) return false;
  const dbUser = await client.user.findUnique({ where: { id: userId } });
  if (!dbUser) return false;
  return (
    dbUser.role === "ADMIN" ||
    dbUser.role === "SUPER_USER" ||
    isWhitelistedAdminEmail(dbUser.email)
  );
}
