import type { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { excludedAuthorIds } from "@libs/server/blocks";
import { isModeratorUser } from "@libs/server/adminAccess";

/**
 * viewer 가 볼 수 있는 댓글 조건. 게시글 상세 댓글 목록과 댓글 좋아요가 같이 쓴다.
 * - viewer 가 차단한 사람의 댓글은 뺀다.
 * - 숨긴 댓글은 작성자 본인과 관리자에게만 보인다.
 * 조건이 없으면(관리자·차단 없음) null.
 */
export async function commentVisibilityWhere(
  viewer: NextApiRequest["user"] | undefined
): Promise<Prisma.CommentWhereInput | null> {
  const excluded = await excludedAuthorIds(viewer?.id);
  const hiddenCommentWhere: Prisma.CommentWhereInput | null = isModeratorUser(viewer)
    ? null
    : viewer?.id
      ? { OR: [{ isHidden: false }, { userId: viewer.id }] }
      : { isHidden: false };
  const conditions: Prisma.CommentWhereInput[] = [
    ...(excluded.length ? [{ userId: { notIn: excluded } }] : []),
    ...(hiddenCommentWhere ? [hiddenCommentWhere] : []),
  ];
  if (conditions.length === 0) return null;
  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

/** 댓글 API 오류 응답. 게시글 API 와 같은 { success:false, error, message, errorCode } 형식이다. */
export function sendCommentError(
  res: NextApiResponse,
  status: number,
  errorCode: string,
  message: string
) {
  return res.status(status).json({
    success: false,
    error: message,
    message,
    errorCode,
  });
}

/** 답글을 지운 뒤, 부모가 '삭제된 댓글' 자리인데 남은 답글이 없으면 부모도 지운다. */
async function removeEmptyDeletedParent(parentId: number) {
  const parent = await client.comment.findUnique({
    where: { id: parentId },
    select: { deletedAt: true },
  });
  if (!parent?.deletedAt) return;
  const remaining = await client.comment.count({ where: { parentId } });
  if (remaining === 0) {
    await client.comment.deleteMany({ where: { id: parentId, deletedAt: { not: null } } });
  }
}

export type CommentDeleteMode = "hard" | "placeholder";

/**
 * 작성자 삭제.
 * - 답글이 남은 루트는 본문을 비우고 deletedAt 만 남긴다('삭제된 댓글입니다' 자리).
 * - 그 밖에는 행을 지운다. 답글을 지워 부모 자리가 비면 부모도 지운다.
 * 행을 지우는 쪽이 기본이라 곳곳의 댓글 수(_count)·랭킹은 따로 고치지 않는다.
 */
export async function deleteOwnComment(target: {
  id: number;
  parentId: number | null;
}): Promise<CommentDeleteMode> {
  if (target.parentId == null) {
    const replyCount = await client.comment.count({ where: { parentId: target.id } });
    if (replyCount > 0) {
      await client.comment.update({
        where: { id: target.id },
        data: { deletedAt: new Date(), comment: "" },
      });
      return "placeholder";
    }
    await client.comment.delete({ where: { id: target.id } });
    return "hard";
  }
  await client.comment.delete({ where: { id: target.id } });
  await removeEmptyDeletedParent(target.parentId);
  return "hard";
}

/**
 * 운영자 삭제. 루트면 답글까지 지운다(relationMode = "prisma" 라 자기 참조 Cascade 가 없다).
 * 답글이면 위와 같이 빈 '삭제된 댓글' 부모를 정리한다.
 */
export async function deleteCommentWithReplies(id: number) {
  const target = await client.comment.findUnique({
    where: { id },
    select: { parentId: true },
  });
  if (!target) return;
  await client.comment.deleteMany({ where: { parentId: id } });
  await client.comment.delete({ where: { id } });
  if (target.parentId != null) await removeEmptyDeletedParent(target.parentId);
}
