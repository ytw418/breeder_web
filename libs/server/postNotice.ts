import client from "@libs/server/client";

/** 관리자만 쓸 수 있는 게시글 카테고리 */
export const NOTICE_POST_CATEGORY = "공지";

/** 이 제목으로 시작하는 글도 공지로 취급된다(상세 isNoticePost·공지 목록과 같은 기준). */
const NOTICE_TITLE_PREFIX = "[공지]";

/** 작성·수정 입력이 공지로 취급되는지(카테고리 "공지" 또는 제목이 "[공지]"로 시작). */
export const isNoticePostInput = ({
  category,
  title,
}: {
  category?: unknown;
  title?: unknown;
}) =>
  String(category) === NOTICE_POST_CATEGORY ||
  String(title ?? "").trim().startsWith(NOTICE_TITLE_PREFIX);

/** 공지 카테고리로 작성·수정할 수 있는지(ADMIN/SUPER_USER) 확인한다. */
export async function canWriteNoticePost(userId?: number): Promise<boolean> {
  if (!userId) return false;
  const dbUser = await client.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return Boolean(dbUser && ["ADMIN", "SUPER_USER"].includes(dbUser.role));
}
