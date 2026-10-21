import client from "@libs/server/client";
import { getBlockRelatedIds, getBlockRelation } from "@libs/server/blocks";
import { isCrewUser } from "@libs/server/crew";
import { tradeErrors } from "@libs/server/trade";
import type {
  BuyerCandidatesResponse,
  TradeCandidateRank,
  TradeCandidateUser,
} from "@libs/shared/tradeReview";

/**
 * 입양자 후보(앱 docs/prd/trade-review.md §3.4). 분양자가 '누구에게 분양했나요?' 시트에서 고르는 사람이고,
 * sold·buyer 의 buyerId 는 반드시 이 세 묶음 중 하나여야 한다(모르는 회원에게 '입양자 지정' 푸시를 보내지 못하게).
 * - requested: 이 분양글로 '입양자 지정 요청'(ADOPTER_REQUESTED 알림)을 보낸 회원
 * - primary  : 이 분양글 카드(Message.productId)가 있는 분양자의 방 상대
 * - others   : 분양자와 서로 메시지(카드 제외)를 1개 이상 주고받은 1:1 방 상대(최근 30명만 보여 준다)
 * 제외: 분양자 본인, 활동 중(ACTIVE)이 아닌 회원, 서로 어느 쪽이든 차단한 회원, 운영 크루.
 */

/** 시트 '다른 대화 상대'에 보여 주는 최대 인원. 지정 검증은 이 수와 관계없이 전체 대화로 한다. */
export const OTHER_CANDIDATES_LIMIT = 30;
/** 요청·카드 묶음에서 읽는 최대 행(한 분양글에 이보다 많을 일은 드물다). */
const SECTION_SCAN_LIMIT = 50;

const ADOPTER_REQUESTED = "ADOPTER_REQUESTED" as const;

/** 두 사람이 모두 멤버인 방(1:1 방) 조건. */
const roomOf = (a: number, b: number) => ({
  AND: [{ chatRoomMembers: { some: { userId: a } } }, { chatRoomMembers: { some: { userId: b } } }],
});

/** 상대 id(1:1 방이라 분양자가 아닌 멤버 한 명). */
const otherMember = (members: { userId: number }[], sellerId: number) =>
  members.find((member) => member.userId !== sellerId)?.userId ?? null;

export async function getBuyerCandidates(
  productId: number,
  sellerId: number
): Promise<Omit<BuyerCandidatesResponse, "success">> {
  const [requests, cards, conversationRooms] = await Promise.all([
    client.notification.findMany({
      where: { type: ADOPTER_REQUESTED, userId: sellerId, targetType: "product", targetId: productId },
      orderBy: { createdAt: "desc" },
      select: { senderId: true, createdAt: true },
      take: SECTION_SCAN_LIMIT,
    }),
    client.message.findMany({
      where: { productId, chatRoom: { chatRoomMembers: { some: { userId: sellerId } } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { chatRoomId: true, createdAt: true },
      take: SECTION_SCAN_LIMIT,
    }),
    client.chatRoom.findMany({
      where: {
        AND: [
          { chatRoomMembers: { some: { userId: sellerId } } },
          { messages: { some: { userId: sellerId, productId: null } } },
          { messages: { some: { userId: { not: sellerId }, productId: null } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      // 제외될 사람(탈퇴·차단·크루)이 섞여도 30명을 채울 수 있게 넉넉히 읽는다.
      take: OTHER_CANDIDATES_LIMIT * 2,
      select: { id: true, updatedAt: true, chatRoomMembers: { select: { userId: true } } },
    }),
  ]);

  // 카드가 있는 방의 상대·최근 대화 시각
  const cardRoomIds = Array.from(new Set(cards.map((card) => card.chatRoomId)));
  const cardRooms = cardRoomIds.length
    ? await client.chatRoom.findMany({
        where: { id: { in: cardRoomIds } },
        select: { id: true, updatedAt: true, chatRoomMembers: { select: { userId: true } } },
      })
    : [];
  const cardRoomById = new Map(cardRooms.map((room) => [room.id, room]));

  const candidateIds = new Set<number>();
  requests.forEach((row) => candidateIds.add(row.senderId));
  cardRooms.forEach((room) => {
    const id = otherMember(room.chatRoomMembers, sellerId);
    if (id != null) candidateIds.add(id);
  });
  conversationRooms.forEach((room) => {
    const id = otherMember(room.chatRoomMembers, sellerId);
    if (id != null) candidateIds.add(id);
  });
  candidateIds.delete(sellerId);

  const ids = Array.from(candidateIds);
  const [users, blocked] = await Promise.all([
    ids.length
      ? client.user.findMany({
          where: { id: { in: ids }, status: "ACTIVE" },
          select: { id: true, name: true, avatar: true },
        })
      : [],
    getBlockRelatedIds(sellerId, ids),
  ]);
  const userById = new Map<number, TradeCandidateUser>();
  users.forEach((user) => {
    if (blocked.has(user.id) || isCrewUser(user)) return;
    userById.set(user.id, { id: user.id, name: user.name, avatar: user.avatar ?? null });
  });

  const seen = new Set<number>();
  const take = (id: number | null): TradeCandidateUser | null => {
    if (id == null || seen.has(id)) return null;
    const user = userById.get(id);
    if (!user) return null;
    seen.add(id);
    return user;
  };

  const requested: BuyerCandidatesResponse["requested"] = [];
  requests.forEach((row) => {
    const user = take(row.senderId);
    if (user) requested.push({ user, requestedAt: row.createdAt.toISOString() });
  });

  const primary: BuyerCandidatesResponse["primary"] = [];
  cards.forEach((card) => {
    const room = cardRoomById.get(card.chatRoomId);
    if (!room) return;
    const user = take(otherMember(room.chatRoomMembers, sellerId));
    if (user) {
      primary.push({
        user,
        chatRoomId: room.id,
        lastMessageAt: room.updatedAt.toISOString(),
        cardAt: card.createdAt.toISOString(),
      });
    }
  });

  const others: BuyerCandidatesResponse["others"] = [];
  for (const room of conversationRooms) {
    if (others.length >= OTHER_CANDIDATES_LIMIT) break;
    const user = take(otherMember(room.chatRoomMembers, sellerId));
    if (user) others.push({ user, chatRoomId: room.id, lastMessageAt: room.updatedAt.toISOString() });
  }

  return { requested, primary, others };
}

/** buyerId 가 어느 후보 묶음에 드는지(앞 묶음 우선). 어디에도 없으면 null. */
async function findCandidateRank(
  productId: number,
  sellerId: number,
  buyerId: number
): Promise<TradeCandidateRank | null> {
  const requested = await client.notification.findFirst({
    where: {
      type: ADOPTER_REQUESTED,
      userId: sellerId,
      senderId: buyerId,
      targetType: "product",
      targetId: productId,
    },
    select: { id: true },
  });
  if (requested) return "requested";

  const card = await client.message.findFirst({
    where: { productId, chatRoom: roomOf(sellerId, buyerId) },
    select: { id: true },
  });
  if (card) return "primary";

  const room = await client.chatRoom.findFirst({
    where: {
      AND: [
        ...roomOf(sellerId, buyerId).AND,
        { messages: { some: { userId: sellerId, productId: null } } },
        { messages: { some: { userId: buyerId, productId: null } } },
      ],
    },
    select: { id: true },
  });
  return room ? "others" : null;
}

/**
 * sold·buyer 의 buyerId 검증(lock 밖에서 먼저 한다 — 대화 기록은 거래 lock 과 무관하다).
 * 본인·활동 중 아님·크루·후보 밖 → 400 INVALID_BUYER, 어느 쪽이든 차단 → 400 BLOCKED. 통과하면 후보 묶음을 돌려준다.
 */
export async function validateBuyerCandidate(
  productId: number,
  sellerId: number,
  buyerId: number
): Promise<TradeCandidateRank> {
  if (buyerId === sellerId) throw tradeErrors.invalidBuyer();
  const user = await client.user.findUnique({
    where: { id: buyerId },
    select: { id: true, name: true, status: true },
  });
  if (!user || user.status !== "ACTIVE" || isCrewUser(user)) throw tradeErrors.invalidBuyer();
  const relation = await getBlockRelation(sellerId, buyerId);
  if (relation.blockedByMe || relation.blockedMe) throw tradeErrors.blockedBuyer();
  const rank = await findCandidateRank(productId, sellerId, buyerId);
  if (!rank) throw tradeErrors.invalidBuyer();
  return rank;
}

/** 요청 본문의 입양자 선택. empty = 아무것도 안 고름(sold 는 미지정, buyer API 는 400). */
export type BuyerChoice =
  | { kind: "empty" }
  | { kind: "none" }
  | { kind: "external" }
  | { kind: "bredy"; buyerId: number };

/**
 * { buyerId?: number, buyerExternal?: true, clear?: true } → 선택. 둘 이상을 같이 보내거나 buyerId 가 양의 정수가 아니면 null(400).
 * clear 는 buyer API 의 '나중에 정할게요'(지정 해제)다.
 */
export function parseBuyerChoice(input: unknown): BuyerChoice | null {
  if (input == null) return { kind: "empty" };
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const body = input as { buyerId?: unknown; buyerExternal?: unknown; clear?: unknown };
  const hasBuyerId = body.buyerId !== undefined && body.buyerId !== null;
  const external = body.buyerExternal === true;
  const clear = body.clear === true;
  if ([hasBuyerId, external, clear].filter(Boolean).length > 1) return null;
  if (external) return { kind: "external" };
  if (clear) return { kind: "none" };
  if (!hasBuyerId) return { kind: "empty" };
  const raw = body.buyerId;
  const buyerId = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(buyerId) || buyerId <= 0) return null;
  return { kind: "bredy", buyerId };
}
