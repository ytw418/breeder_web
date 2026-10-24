import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { CREW_USER_ID_MAX, CREW_USER_ID_MIN } from "@libs/server/crew";
import { isAdminEmail } from "@libs/shared/adminEmail";

/**
 * 작성 제한(2026-10-21 감사 24번). 사기 계정 하나가 가입 직후 분양글·채팅을 뿌리지 못하게 막는다.
 * - 가입 7일 미만: 분양글+경매 합계 KST 하루 3개, 새 1:1 채팅방 하루 5개.
 * - 모든 계정: 같은 본문(분양글 설명·경매 설명·텍스트 메시지)은 10분에 3번까지.
 *   메시지는 10자 이상만 센다('네'·'감사합니다' 같은 짧은 답을 여러 방에 보내는 것은 막지 않는다).
 * - 운영자 이메일·운영 크루(id 범위)는 제외한다. 크루 이름 꼬리('·크루')는 누구나 붙일 수 있어 보지 않는다.
 * - env WRITE_LIMIT_EXEMPT_USER_IDS(쉼표 구분 id)로 지정한 운영 계정도 제외한다 — 보호소 소식 계정처럼 크루 범위 밖에서
 *   만든 운영 계정용. dev·운영의 id 가 달라 env 로 둔다(2026-10-24 사용자 결정).
 * - 분양글 카드(Message.productId, 서버가 넣는 행)는 같은 본문으로 세지 않는다. 그 카드가 이번 요청에서 새로 들어가는
 *   입양 희망자의 첫 메시지(추천 칩 '아직 분양 중인가요?' 등, 방·글당 1번)도 한도에서 뺀다(앱 docs/prd/trade-review.md §3.6).
 * 넘으면 429 + 문구를 돌려준다. 앱(구버전 포함)·웹은 서버 error 문구를 토스트로 그대로 보여 준다.
 */

export const NEW_ACCOUNT_DAYS = 7;
export const NEW_ACCOUNT_DAILY_LISTINGS = 3;
export const NEW_ACCOUNT_DAILY_CHAT_ROOMS = 5;
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const DUPLICATE_MAX = 3;
export const DUPLICATE_MESSAGE_MIN_LENGTH = 10;

export const WRITE_LIMIT_DAILY_MESSAGE = "지금은 더 등록할 수 없어요. 내일 다시 시도해 주세요.";
export const WRITE_LIMIT_CHAT_ROOM_MESSAGE = "지금은 새 채팅을 더 시작할 수 없어요. 내일 다시 시도해 주세요.";
export const WRITE_LIMIT_DUPLICATE_MESSAGE = "같은 내용을 너무 자주 보내고 있어요. 잠시 후 다시 시도해 주세요.";

export type WriteKind = "product" | "auction" | "chatRoom" | "message";

export interface WriteLimitBlock {
  status: 429;
  error: string;
  errorCode: "WRITE_LIMIT_DAILY" | "WRITE_LIMIT_DUPLICATE";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 오늘 0시(UTC Date). */
function kstDayStart(now = new Date()): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
}

const dailyBlock = (kind: WriteKind): WriteLimitBlock => ({
  status: 429,
  error: kind === "chatRoom" ? WRITE_LIMIT_CHAT_ROOM_MESSAGE : WRITE_LIMIT_DAILY_MESSAGE,
  errorCode: "WRITE_LIMIT_DAILY",
});
const DUPLICATE_BLOCK: WriteLimitBlock = {
  status: 429,
  error: WRITE_LIMIT_DUPLICATE_MESSAGE,
  errorCode: "WRITE_LIMIT_DUPLICATE",
};

const exemptUserIds = (): number[] =>
  (process.env.WRITE_LIMIT_EXEMPT_USER_IDS ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

function isExempt(user: { id: number; email: string | null }): boolean {
  if (isAdminEmail(user.email)) return true;
  if (exemptUserIds().includes(user.id)) return true;
  return user.id >= CREW_USER_ID_MIN && user.id <= CREW_USER_ID_MAX;
}

type Db = Prisma.TransactionClient | typeof client;

/** 같은 본문(앞뒤 공백만 다른 것 포함)을 최근 10분 안에 몇 번 보냈는지. */
async function countRecentSameText(
  userId: number,
  kind: WriteKind,
  text: string,
  db: Db = client
): Promise<number> {
  const values = Array.from(new Set([text, text.trim()]));
  const createdAt = { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) };
  if (kind === "product") {
    return client.product.count({ where: { userId, createdAt, description: { in: values } } });
  }
  if (kind === "auction") {
    return client.auction.count({ where: { userId, createdAt, description: { in: values } } });
  }
  if (kind === "message") {
    // 분양글 카드 행(productId 있음)은 서버가 만든 스냅샷이라 세지 않는다.
    return db.message.count({
      where: { userId, type: "TEXT", productId: null, createdAt, message: { in: values } },
    });
  }
  return 0;
}

/** 오늘(KST) 만든 분양글·경매 수 또는 새 1:1 채팅방 수. */
async function countToday(userId: number, kind: WriteKind): Promise<number> {
  const since = kstDayStart();
  if (kind === "chatRoom") {
    // 방에 생성자 기록이 없어 '오늘 들어간 오늘 만든 방'으로 센다(상대가 먼저 연 방도 셈, 근사치).
    return client.chatRoomMember.count({
      where: { userId, createdAt: { gte: since }, chatRoom: { createdAt: { gte: since } } },
    });
  }
  const [products, auctions] = await Promise.all([
    client.product.count({ where: { userId, createdAt: { gte: since } } }),
    client.auction.count({ where: { userId, createdAt: { gte: since } } }),
  ]);
  return products + auctions;
}

/**
 * 쓰기 전에 부른다. 막아야 하면 { status: 429, error, errorCode }, 아니면 null.
 * text 는 저장할 본문 그대로 넘긴다(분양글·경매 설명, 텍스트 메시지). 새 채팅방은 text 없이 부른다.
 * withNewProductCard 는 이 메시지와 함께 분양글 카드가 방금 새로 들어갈 때만 true 로 넘긴다(lock 안에서 카드가 없음을
 * 다시 확인한 뒤, 분양자 본인이 아닐 때). 클라이언트가 productId 를 붙이기만 해서는 한도를 피하지 못한다.
 * db 는 트랜잭션 안에서 부를 때 tx 를 넘긴다(메시지 검사만 쓴다).
 */
export async function assertWriteAllowed({
  userId,
  kind,
  text,
  withNewProductCard = false,
  db = client,
}: {
  userId: number;
  kind: WriteKind;
  text?: string | null;
  withNewProductCard?: boolean;
  db?: Db;
}): Promise<WriteLimitBlock | null> {
  const body = typeof text === "string" && text.trim() ? text : null;

  // 메시지는 보낼 때마다 불리므로 같은 본문을 먼저 세고, 넘을 때만 사용자(예외 여부)를 읽는다.
  if (kind === "message") {
    if (withNewProductCard) return null;
    if (!body || body.trim().length < DUPLICATE_MESSAGE_MIN_LENGTH) return null;
    if ((await countRecentSameText(userId, kind, body, db)) < DUPLICATE_MAX) return null;
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    return user && isExempt(user) ? null : DUPLICATE_BLOCK;
  }

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user || isExempt(user)) return null;

  const isNewAccount = Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_DAYS * DAY_MS;
  if (isNewAccount) {
    const limit = kind === "chatRoom" ? NEW_ACCOUNT_DAILY_CHAT_ROOMS : NEW_ACCOUNT_DAILY_LISTINGS;
    if ((await countToday(userId, kind)) >= limit) return dailyBlock(kind);
  }
  if (body && (await countRecentSameText(userId, kind, body)) >= DUPLICATE_MAX) return DUPLICATE_BLOCK;
  return null;
}
