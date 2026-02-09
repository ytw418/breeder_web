import client from "@libs/server/client";

export async function hasAdminAccess(userId?: number) {
  if (!userId) return false;
  const dbUser = await client.user.findUnique({ where: { id: userId } });
  if (!dbUser) return false;
  return dbUser.role === "ADMIN" || dbUser.email?.includes("ytw418@naver");
}

