import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { filterPushRecipients } from "@libs/server/notificationGate";
import { sendAllPushToUsers } from "@libs/server/pushGateway";

/**
 * 운영자 푸시 발송(커뮤니티 감사 #22). /admin/push 와 공지 등록 '푸시도 보내기'가 같이 쓴다.
 * - 대상: 전체(활동 중 계정) 또는 N일 미접속(lastActiveAt 이 N일 전보다 이전, 기록이 없으면 가입이 N일 전보다 이전).
 * - 알림 목록에 ADMIN_BROADCAST 한 줄('브리디 운영팀'), 푸시는 '브리디 소식'을 켠 사람(방해 금지 시간 밖)에게만.
 * - 하루 1회: 최근 24시간 안에 ADMIN_BROADCAST 가 있으면 보내지 않는다(429).
 * 관심 종 대상 선택은 2차(감사 deferred #22).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const ADMIN_BROADCAST_COOLDOWN_MS = DAY_MS;
export const ADMIN_BROADCAST_TITLE_MAX = 40;
export const ADMIN_BROADCAST_BODY_MAX = 120;
export const ADMIN_BROADCAST_DEFAULT_INACTIVE_DAYS = 7;
const CHUNK = 1000;

export type BroadcastAudience = "all" | "inactive";

export interface BroadcastInput {
  audience: BroadcastAudience;
  inactiveDays: number;
  title: string;
  body: string;
  url: string;
}

export type BroadcastValidation = { ok: true; value: BroadcastInput } | { ok: false; message: string };

/** 요청 본문 → 발송 입력. 링크는 사이트 안 경로('/'로 시작)만 받는다. */
export function parseBroadcastInput(raw: Record<string, unknown>): BroadcastValidation {
  const audience = raw.audience === "inactive" ? "inactive" : raw.audience === "all" ? "all" : null;
  if (!audience) return { ok: false, message: "보낼 대상을 골라 주세요." };
  const inactiveDays = raw.inactiveDays === undefined ? ADMIN_BROADCAST_DEFAULT_INACTIVE_DAYS : Number(raw.inactiveDays);
  if (audience === "inactive" && (!Number.isInteger(inactiveDays) || inactiveDays < 1 || inactiveDays > 90)) {
    return { ok: false, message: "미접속 기간은 1~90일로 적어 주세요." };
  }
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!title || title.length > ADMIN_BROADCAST_TITLE_MAX) {
    return { ok: false, message: `제목은 1~${ADMIN_BROADCAST_TITLE_MAX}자로 적어 주세요.` };
  }
  if (body.length > ADMIN_BROADCAST_BODY_MAX) {
    return { ok: false, message: `본문은 ${ADMIN_BROADCAST_BODY_MAX}자까지 적을 수 있어요.` };
  }
  const url = typeof raw.url === "string" && raw.url.trim() ? raw.url.trim() : "/";
  if (!url.startsWith("/") || url.startsWith("//")) {
    return { ok: false, message: "링크는 /posts/123 처럼 사이트 안 주소로 적어 주세요." };
  }
  return { ok: true, value: { audience, inactiveDays, title, body, url } };
}

export function broadcastAudienceWhere(
  input: Pick<BroadcastInput, "audience" | "inactiveDays">,
  now: Date = new Date()
): Prisma.UserWhereInput {
  if (input.audience === "all") return { status: "ACTIVE" };
  const before = new Date(now.getTime() - input.inactiveDays * DAY_MS);
  return {
    status: "ACTIVE",
    OR: [{ lastActiveAt: { lt: before } }, { lastActiveAt: null, createdAt: { lt: before } }],
  };
}

/** 미리보기: 대상 수와 그중 푸시 기기가 있는 사람 수. */
export async function countBroadcastAudience(
  input: Pick<BroadcastInput, "audience" | "inactiveDays">,
  now: Date = new Date()
): Promise<{ total: number; withDevice: number }> {
  const where = broadcastAudienceWhere(input, now);
  const [total, withDevice] = await Promise.all([
    client.user.count({ where }),
    client.user.count({ where: { AND: [where, { fcmTokens: { some: {} } }] } }),
  ]);
  return { total, withDevice };
}

/** 24시간 안 마지막 발송 시각. 없으면 null. */
export async function recentBroadcastAt(now: Date = new Date()): Promise<Date | null> {
  const last = await client.notification.findFirst({
    where: { type: "ADMIN_BROADCAST", createdAt: { gte: new Date(now.getTime() - ADMIN_BROADCAST_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}

/** 알림 목록에서 눌렀을 때 갈 대상. 글·분양·경매·프로필 주소만 알아본다(그 밖은 푸시로만 연다). */
export function broadcastTarget(url: string): { targetType: string; targetId: number } | null {
  const match = url.match(/^\/(posts|products|auctions|profiles)\/(\d+)/);
  if (!match) return null;
  const targetType = { posts: "post", products: "product", auctions: "auction", profiles: "user" }[
    match[1] as "posts" | "products" | "auctions" | "profiles"
  ];
  return { targetType, targetId: Number(match[2]) };
}

export function broadcastMessage(input: Pick<BroadcastInput, "title" | "body">): string {
  return input.body ? `${input.title}: ${input.body}` : input.title;
}

/** 발송. 돌려주는 값은 알림을 받은 사람 수와 푸시를 보낸 사람 수. 하루 1회 확인은 부르는 쪽이 먼저 한다. */
export async function sendAdminBroadcast({
  senderId,
  input,
  now = new Date(),
}: {
  senderId: number;
  input: BroadcastInput;
  now?: Date;
}): Promise<{ recipients: number; pushed: number }> {
  const ids = (
    await client.user.findMany({
      where: broadcastAudienceWhere(input, now),
      select: { id: true },
      orderBy: { id: "asc" },
    })
  ).map((user) => user.id);
  if (!ids.length) return { recipients: 0, pushed: 0 };

  const message = broadcastMessage(input);
  const target = broadcastTarget(input.url);
  for (let index = 0; index < ids.length; index += CHUNK) {
    await client.notification.createMany({
      data: ids.slice(index, index + CHUNK).map((userId) => ({
        type: "ADMIN_BROADCAST" as const,
        message,
        userId,
        senderId,
        targetType: target?.targetType ?? null,
        targetId: target?.targetId ?? null,
      })),
    });
  }

  const pushIds = await filterPushRecipients(ids, "ADMIN_BROADCAST", now);
  const tag = `admin-broadcast-${now.getTime()}`;
  for (let index = 0; index < pushIds.length; index += CHUNK) {
    await sendAllPushToUsers(pushIds.slice(index, index + CHUNK), {
      title: input.title,
      body: input.body || "브리디 운영팀 소식",
      url: input.url,
      tag,
    });
  }
  return { recipients: ids.length, pushed: pushIds.length };
}
