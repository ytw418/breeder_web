import client from "@libs/server/client";

/** 관리자만 쓸 수 있는 게시글 카테고리 */
export const NOTICE_POST_CATEGORY = "공지";

/** 공지 카테고리로 작성·수정할 수 있는지(ADMIN/SUPER_USER) 확인한다. */
export async function canWriteNoticePost(userId?: number): Promise<boolean> {
  if (!userId) return false;
  const dbUser = await client.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return Boolean(dbUser && ["ADMIN", "SUPER_USER"].includes(dbUser.role));
}
