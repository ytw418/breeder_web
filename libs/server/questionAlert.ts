import client from "@libs/server/client";
import { sendAllPushToUsers } from "@libs/server/pushGateway";

/**
 * 새 질문 알림. 질문 글이 올라오면 그 글 분야(또는 상위 분야)를 관심 카테고리로 고정한 사람에게
 * '답변을 기다리는 질문' 알림(NEW_POST 형식, 누르면 글로 간다)과 푸시를 보낸다.
 * - 작성자, 작성자와 차단 관계인 사람, 정지·탈퇴 계정은 뺀다.
 * - 12시간 안에 이미 질문 알림을 받은 사람에게는 보내지 않는다(질문이 몰려도 하루 두 번 이하).
 * - 종을 고르지 않아 분야가 없는 질문은 보내지 않는다.
 * 알림 형식을 새로 만들지 않고 NEW_POST 를 써서 구 앱·웹도 그대로 보여 준다.
 */
export const QUESTION_ALERT_MESSAGE_PREFIX = "답변을 기다리는 질문이 올라왔어요";
export const QUESTION_ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const QUESTION_ALERT_MAX_RECIPIENTS = 200;

/** "/insect/stag-beetle/" → ["/insect/", "/insect/stag-beetle/"] */
function pathWithAncestors(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  return segments.map((_, index) => `/${segments.slice(0, index + 1).join("/")}/`);
}

export async function notifyQuestionToInterestedUsers({
  postId,
  authorId,
  title,
  categoryId,
}: {
  postId: number;
  authorId: number;
  title: string;
  categoryId: number | null;
}): Promise<number[]> {
  if (!categoryId) return [];
  try {
    const category = await client.category.findUnique({
      where: { id: categoryId },
      select: { path: true },
    });
    if (!category) return [];
    const scopeIds = (
      await client.category.findMany({
        where: { path: { in: pathWithAncestors(category.path) } },
        select: { id: true },
      })
    ).map((row) => row.id);
    if (!scopeIds.length) return [];

    const blocks = await client.userBlock.findMany({
      where: { OR: [{ blockerId: authorId }, { blockedId: authorId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocks.map((block) =>
      block.blockerId === authorId ? block.blockedId : block.blockerId
    );

    const candidates = (
      await client.user.findMany({
        where: {
          id: { notIn: [authorId, ...blockedIds] },
          status: "ACTIVE",
          pinnedCategoryIds: { hasSome: scopeIds },
        },
        select: { id: true },
        orderBy: { id: "desc" },
        take: QUESTION_ALERT_MAX_RECIPIENTS,
      })
    ).map((user) => user.id);
    if (!candidates.length) return [];

    const recentlyAlerted = new Set(
      (
        await client.notification.findMany({
          where: {
            userId: { in: candidates },
            type: "NEW_POST",
            message: { startsWith: QUESTION_ALERT_MESSAGE_PREFIX },
            createdAt: { gte: new Date(Date.now() - QUESTION_ALERT_COOLDOWN_MS) },
          },
          select: { userId: true },
        })
      ).map((row) => row.userId)
    );
    const recipients = candidates.filter((id) => !recentlyAlerted.has(id));
    if (!recipients.length) return [];

    const message = `${QUESTION_ALERT_MESSAGE_PREFIX}: ${title}`;
    await client.notification.createMany({
      data: recipients.map((userId) => ({
        type: "NEW_POST" as const,
        message,
        userId,
        senderId: authorId,
        targetId: postId,
        targetType: "post",
      })),
    });
    await sendAllPushToUsers(recipients, {
      title: "브리디 알림",
      body: message,
      url: `/posts/${postId}`,
      tag: `question-post-${postId}`,
    });
    return recipients;
  } catch (error) {
    console.error("[questionAlert] failed:", error);
    return [];
  }
}
