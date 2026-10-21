import client from "@libs/server/client";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import { filterPushRecipients } from "@libs/server/notificationGate";

/**
 * 관심 분야 알림. 글이 올라오면 그 글 분야(또는 상위 분야)를 관심 카테고리로 고정한 사람에게
 * 알림(NEW_POST 형식, 누르면 글로 간다)과 푸시를 보낸다. 종류는 둘이다.
 * - question: 질문 글 → '답변을 기다리는 질문이 올라왔어요: 제목'. 12시간 안에 질문 알림을 받은 사람은 건너뛴다(하루 두 번 이하).
 * - newcomer: 가입 7일 안 회원의 첫 글(커뮤니티 감사 #20) → '새 회원 ○○님의 첫 글이에요: 제목'. 24시간 안에 받은 사람은 건너뛴다(하루 1통).
 * 쿨다운은 같은 종류끼리만 센다(NEW_POST + 메시지 앞머리로 구분).
 * - 작성자, 작성자와 차단 관계인 사람, 정지·탈퇴 계정은 뺀다. 분야가 없는 글은 보내지 않는다.
 * 알림 형식을 새로 만들지 않고 NEW_POST 를 써서 구 앱·웹도 그대로 보여 준다(새 앱·웹은 앞머리로 '질문'·'새 회원'으로 보인다, libs/shared/notificationFormat).
 * - 알림 행은 모두 만들고, 푸시는 '팔로우·새 글' 종류를 켠 사람(방해 금지 시간 밖)에게만 보낸다.
 */
export const QUESTION_ALERT_MESSAGE_PREFIX = "답변을 기다리는 질문이 올라왔어요";
export const QUESTION_ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const QUESTION_ALERT_MAX_RECIPIENTS = 200;

/** 새 회원 첫 글 알림 앞머리(뒤에 '○○님의 첫 글이에요: 제목'). libs/shared/notificationFormat NEWCOMER_ALERT_PREFIX 와 같다. */
export const NEWCOMER_ALERT_MESSAGE_PREFIX = "새 회원 ";
export const NEWCOMER_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type InterestAlertKind = "question" | "newcomer";

const ALERT_RULES: Record<
  InterestAlertKind,
  { prefix: string; cooldownMs: number; tag: string; message: (title: string, authorName: string) => string }
> = {
  question: {
    prefix: QUESTION_ALERT_MESSAGE_PREFIX,
    cooldownMs: QUESTION_ALERT_COOLDOWN_MS,
    tag: "question-post",
    message: (title) => `${QUESTION_ALERT_MESSAGE_PREFIX}: ${title}`,
  },
  newcomer: {
    prefix: NEWCOMER_ALERT_MESSAGE_PREFIX,
    cooldownMs: NEWCOMER_ALERT_COOLDOWN_MS,
    tag: "newcomer-post",
    message: (title, authorName) => `${NEWCOMER_ALERT_MESSAGE_PREFIX}${authorName}님의 첫 글이에요: ${title}`,
  },
};

/** "/insect/stag-beetle/" → ["/insect/", "/insect/stag-beetle/"] */
function pathWithAncestors(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  return segments.map((_, index) => `/${segments.slice(0, index + 1).join("/")}/`);
}

export async function notifyInterestedUsers({
  kind,
  postId,
  authorId,
  authorName = "",
  title,
  categoryId,
  excludeUserIds = [],
}: {
  kind: InterestAlertKind;
  postId: number;
  authorId: number;
  /** newcomer 문구에 들어간다. */
  authorName?: string;
  title: string;
  categoryId: number | null;
  /** 같은 글로 이미 다른 알림을 받은 사람(예: 질문 알림). */
  excludeUserIds?: number[];
}): Promise<number[]> {
  if (!categoryId) return [];
  const rule = ALERT_RULES[kind];
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
          id: { notIn: [authorId, ...blockedIds, ...excludeUserIds] },
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
            message: { startsWith: rule.prefix },
            createdAt: { gte: new Date(Date.now() - rule.cooldownMs) },
          },
          select: { userId: true },
        })
      ).map((row) => row.userId)
    );
    const recipients = candidates.filter((id) => !recentlyAlerted.has(id));
    if (!recipients.length) return [];

    const message = rule.message(title, authorName);
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
    const pushRecipients = await filterPushRecipients(recipients, "NEW_POST");
    if (pushRecipients.length === 0) return recipients;
    await sendAllPushToUsers(pushRecipients, {
      title: "브리디 알림",
      body: message,
      url: `/posts/${postId}`,
      tag: `${rule.tag}-${postId}`,
    });
    return recipients;
  } catch (error) {
    console.error(`[questionAlert:${kind}] failed:`, error);
    return [];
  }
}

/** 새 질문 알림(예전 이름 그대로 둔다). */
export function notifyQuestionToInterestedUsers(params: {
  postId: number;
  authorId: number;
  title: string;
  categoryId: number | null;
}): Promise<number[]> {
  return notifyInterestedUsers({ kind: "question", ...params });
}
