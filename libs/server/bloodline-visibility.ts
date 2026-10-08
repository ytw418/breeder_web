import { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import {
  BLOODLINE_MASKED_USER_NAME,
  type BloodlineCardType,
  type BloodlineUserRef,
} from "@libs/shared/bloodline-card";

/**
 * 받은 사람 닉네임 비공개(설계 §3.4, PRD 부록 A-4). 상세·이력·받은 사람·프로필 목록이 같은 규칙을 쓴다.
 * 카드 응답 안의 사용자는 다음 중 하나면 그대로, 아니면 `{ id: 0, name: "닉네임 비공개", masked: true }`:
 *   1. 뿌리 혈통의 creator 와 뿌리의 currentOwner (항상 공개)
 *   2. 뷰어 본인
 *   3. 뷰어와 직접 주고받은 상대: 뷰어가 보낸 사건(actorUserId 또는 fromUserId = 뷰어)의 받는 사람(toUser),
 *      그리고 뷰어에게 보낸 사건(toUserId = 뷰어)의 보낸 사람(actorUser·fromUser).
 *      받은 사람은 알림("○○님이 … 보냈어요")으로 보낸 사람을 이미 안다. 그래서 출처 카드 화면의
 *      "○○님에게 받았어요"(PRD S-4.받은 사람)가 다음 분에게서 넘겨받은 경우에도 이름으로 보인다.
 *   4. 이 뿌리 아래 ACTIVE 출처 카드를 ownerNameVisible = true 로 가진 사람
 */

type Db = typeof client | Prisma.TransactionClient;
type UserLike = { id: number; name: string } | null | undefined;

export const maskedBloodlineUser = (): BloodlineUserRef => ({
  id: 0,
  name: BLOODLINE_MASKED_USER_NAME,
  masked: true,
});

/**
 * 프로필 "보유 혈통" 목록(GET /api/users/[id]/bloodline-cards)과 프로필 뱃지 수(GET /api/users/[id] 의
 * `_count.ownedBloodlineCards`)가 함께 쓰는 조건. 지금 보유한 ACTIVE 카드만 세고, 출처 카드는 닉네임 공개를 켰거나
 * 본인이 볼 때만 센다(설계 §3.4, P1-13). 뿌리가 숨김·회수된 출처 카드는 isProfileBloodlineCardShown 으로 한 번 더 뺀다.
 */
export const profileBloodlineCardWhere = (
  userId: number,
  viewerId: number | null | undefined
): Prisma.BloodlineCardWhereInput => ({
  currentOwnerId: userId,
  status: "ACTIVE",
  ...(viewerId === userId
    ? {}
    : { OR: [{ cardType: "BLOODLINE" }, { cardType: "LINE", ownerNameVisible: true }] }),
});

/** 출처 카드면 뿌리 혈통 id, 혈통이면 자기 id. */
export const rootIdOf = (card: {
  id: number;
  cardType: BloodlineCardType | string;
  bloodlineReferenceId: number | null;
}) => (card.cardType === "LINE" ? card.bloodlineReferenceId ?? card.id : card.id);

/**
 * 프로필 목록·뱃지 수가 함께 쓰는 마지막 조건: 출처 카드는 뿌리가 ACTIVE 일 때만 남긴다
 * (뿌리가 숨김·회수면 상세가 404 BLOODLINE_REVOKED 라 열 수 없다). rootStatuses 는 뿌리 id → status.
 */
export const isProfileBloodlineCardShown = (
  card: { id: number; cardType: BloodlineCardType | string; bloodlineReferenceId: number | null },
  rootStatuses: ReadonlyMap<number, string>
) => card.cardType !== "LINE" || rootStatuses.get(rootIdOf(card)) === "ACTIVE";

/**
 * 프로필 "보유 혈통" 수(GET /api/users/[id] 의 `_count.ownedBloodlineCards`). 목록 API(GET /api/users/[id]/bloodline-cards)와
 * 같은 기준으로 센다: profileBloodlineCardWhere + 뿌리가 ACTIVE 인 출처 카드만(isProfileBloodlineCardShown).
 * 뿌리 상태는 관계가 없어(bloodlineReferenceId) Prisma 필터로 걸 수 없으므로 보유 카드에서 출발해 쿼리 2번으로 센다.
 */
export async function countProfileBloodlineCards(
  userId: number,
  viewerId: number | null | undefined,
  db: Db = client
): Promise<number> {
  const cards = await db.bloodlineCard.findMany({
    where: profileBloodlineCardWhere(userId, viewerId),
    select: { id: true, cardType: true, bloodlineReferenceId: true },
  });
  const rootIds = Array.from(
    new Set(cards.filter((card) => card.cardType === "LINE").map((card) => rootIdOf(card)))
  );
  const roots = rootIds.length
    ? await db.bloodlineCard.findMany({
        where: { id: { in: rootIds } },
        select: { id: true, status: true },
      })
    : [];
  const rootStatuses = new Map(roots.map((root) => [root.id, root.status as string]));
  return cards.filter((card) => isProfileBloodlineCardShown(card, rootStatuses)).length;
}

/* ------------------------------------------------------------------ */
/* 메모(note) 공개 범위                                                 */
/* ------------------------------------------------------------------ */

/** 시스템이 쓴 고정 문구라 누구에게나 보여도 되는 이력 메모("혈통을 만들었어요", "운영 정책으로 회수" 등). */
const PUBLIC_NOTE_EVENT_ACTIONS: ReadonlySet<string> = new Set([
  "BLOODLINE_CREATED",
  "LINE_CREATED",
  "CARD_REVOKED",
]);

/** 뷰어가 주어진 사람 중 하나인지(비로그인은 늘 false). */
const isPartyOf = (
  viewerId: number | null | undefined,
  userIds: ReadonlyArray<number | null | undefined>
) => typeof viewerId === "number" && viewerId > 0 && userIds.some((id) => id === viewerId);

/**
 * 이력 메모를 이 뷰어에게 보여도 되는지. 보내기·넘기기 메모(LINE_ISSUED·LINE_TRANSFER·BLOODLINE_TRANSFER)는
 * 보낸 사람이 받는 분에게 쓴 글이라 그 사건의 당사자(actor·from·to)만 본다. 받은 사람 닉네임을 가려도
 * 메모로 신원·연락처·거래 내용이 드러나지 않게 하려는 것이다. 시스템 문구 사건은 공개다.
 */
export function canSeeBloodlineEventNote(
  viewerId: number | null | undefined,
  event: {
    action: string;
    actorUserId: number | null;
    fromUserId: number | null;
    toUserId: number | null;
  }
): boolean {
  if (PUBLIC_NOTE_EVENT_ACTIONS.has(event.action)) return true;
  return isPartyOf(viewerId, [event.actorUserId, event.fromUserId, event.toUserId]);
}

/**
 * 출처 카드(LINE)의 description(= 보낼 때 쓴 메모)을 이 뷰어에게 보여도 되는지:
 * 지금 보유자(받은 분)와 보낸 사람(creator)만. 혈통(BLOODLINE)의 description 은 공개 소개라 늘 true.
 */
export function canSeeBloodlineCardMemo(
  viewerId: number | null | undefined,
  card: { cardType: BloodlineCardType | string; creatorId: number | null; currentOwnerId: number | null }
): boolean {
  if (card.cardType !== "LINE") return true;
  return isPartyOf(viewerId, [card.currentOwnerId, card.creatorId]);
}

/** 넘기기 기록(transfers[].note)의 메모: 그 넘기기의 보낸 사람·받은 사람만. */
export const canSeeBloodlineTransferNote = (
  viewerId: number | null | undefined,
  transfer: { fromUserId: number | null; toUserId: number | null }
) => isPartyOf(viewerId, [transfer.fromUserId, transfer.toUserId]);

export interface BloodlineVisibilityInput {
  viewerId?: number | null;
  /** 뿌리 혈통(없으면 규칙 1 없음) */
  root: { creatorId: number; currentOwnerId: number } | null;
  /** 규칙 3: 뷰어가 직접 보낸 사건의 받는 사람 id */
  viewerSentToUserIds?: ReadonlyArray<number | null | undefined>;
  /** 규칙 3: 뷰어에게 보낸 사건의 보낸 사람 id(actor·from) */
  viewerReceivedFromUserIds?: ReadonlyArray<number | null | undefined>;
  /** 규칙 4: 이 뿌리 아래 ACTIVE 출처 카드를 공개로 둔 보유자 id */
  visibleLineOwnerIds?: ReadonlyArray<number>;
}

const addIds = (target: Set<number>, ids: ReadonlyArray<number | null | undefined> | undefined) => {
  for (const id of ids ?? []) {
    if (typeof id === "number" && id > 0) target.add(id);
  }
};

/** 뷰어와 무관하게 누구에게나 공개인 사람(규칙 1·4). 받은 사람 목록의 nameVisible 에 쓴다. */
export function buildPublicUserIds(
  input: Pick<BloodlineVisibilityInput, "root" | "visibleLineOwnerIds">
): Set<number> {
  const visible = new Set<number>();
  if (input.root) {
    visible.add(input.root.creatorId);
    visible.add(input.root.currentOwnerId);
  }
  addIds(visible, input.visibleLineOwnerIds);
  return visible;
}

/** 규칙 1~4 로 공개 사용자 id 집합을 만든다(순수 함수). */
export function buildVisibleUserIds(input: BloodlineVisibilityInput): Set<number> {
  const visible = buildPublicUserIds(input);
  if (input.viewerId) visible.add(input.viewerId);
  addIds(visible, input.viewerSentToUserIds);
  addIds(visible, input.viewerReceivedFromUserIds);
  return visible;
}

/** 공개 집합에 있으면 { id, name }, 아니면 가린 사용자. null 은 그대로 null(탈퇴 등은 호출처가 처리). */
export function presentBloodlineUser(
  user: UserLike,
  visibleUserIds: ReadonlySet<number>
): BloodlineUserRef | null {
  if (!user) return null;
  return visibleUserIds.has(user.id) ? { id: user.id, name: user.name } : maskedBloodlineUser();
}

export interface BloodlineVisibility {
  rootId: number;
  viewerId: number | null;
  visibleUserIds: ReadonlySet<number>;
  isVisible: (userId: number | null | undefined) => boolean;
  /** 이 뷰어가 아니어도(비로그인 포함) 누구에게나 보이는 사람인지(규칙 1·4) */
  isPublic: (userId: number | null | undefined) => boolean;
  /** 응답에 넣을 사용자로 바꾼다(가리거나 그대로). */
  present: (user: UserLike) => BloodlineUserRef | null;
}

export function createBloodlineVisibility(
  input: BloodlineVisibilityInput & { rootId: number }
): BloodlineVisibility {
  const visibleUserIds = buildVisibleUserIds(input);
  const publicUserIds = buildPublicUserIds(input);
  return {
    rootId: input.rootId,
    viewerId: input.viewerId ?? null,
    visibleUserIds,
    isVisible: (userId) => typeof userId === "number" && visibleUserIds.has(userId),
    isPublic: (userId) => typeof userId === "number" && publicUserIds.has(userId),
    present: (user) => presentBloodlineUser(user, visibleUserIds),
  };
}

type LineageRow = {
  id: number;
  cardType: BloodlineCardType | string;
  status: string;
  creatorId: number;
  currentOwnerId: number;
  ownerNameVisible: boolean;
};
type ViewerEventRow = {
  toUserId: number | null;
  actorUserId: number | null;
  fromUserId: number | null;
};

const lineageSelect = {
  id: true,
  cardType: true,
  status: true,
  creatorId: true,
  currentOwnerId: true,
  ownerNameVisible: true,
} as const;

/** 뷰어가 보냈거나(actor·from) 받은(to) 사건. 받는 사람이 없는 사건(만들기·회수)은 규칙 3과 무관하다. */
const viewerEventWhere = (cardIds: number[], viewerId: number) => ({
  cardId: { in: cardIds },
  toUserId: { not: null },
  OR: [{ actorUserId: viewerId }, { fromUserId: viewerId }, { toUserId: viewerId }],
});
const viewerEventSelect = { toUserId: true, actorUserId: true, fromUserId: true } as const;

function visibilityFromRows(
  rootId: number,
  viewerId: number | null | undefined,
  lineage: ReadonlyArray<LineageRow>,
  viewerEvents: ReadonlyArray<ViewerEventRow>
): BloodlineVisibility {
  const root = lineage.find((card) => card.id === rootId) ?? null;
  const sentTo: Array<number | null> = [];
  const receivedFrom: Array<number | null> = [];
  if (viewerId) {
    for (const event of viewerEvents) {
      if (event.actorUserId === viewerId || event.fromUserId === viewerId) sentTo.push(event.toUserId);
      if (event.toUserId === viewerId) receivedFrom.push(event.actorUserId, event.fromUserId);
    }
  }
  return createBloodlineVisibility({
    rootId,
    viewerId,
    root: root ? { creatorId: root.creatorId, currentOwnerId: root.currentOwnerId } : null,
    viewerSentToUserIds: sentTo,
    viewerReceivedFromUserIds: receivedFrom,
    visibleLineOwnerIds: lineage
      .filter((card) => card.cardType === "LINE" && card.status === "ACTIVE" && card.ownerNameVisible)
      .map((card) => card.currentOwnerId),
  });
}

/**
 * 뿌리 id 로 규칙 1·3·4 에 필요한 값을 읽어 마스킹 문맥을 만든다(쿼리 1~2번).
 * 뿌리 아래 카드(모든 상태)를 한 번에 읽고, 로그인 뷰어면 그 카드들에서 뷰어가 보내거나 받은 사건을 읽는다.
 */
export async function loadBloodlineVisibility(
  rootId: number,
  viewerId?: number | null,
  db: Db = client
): Promise<BloodlineVisibility> {
  const lineage = await db.bloodlineCard.findMany({
    where: { OR: [{ id: rootId }, { bloodlineReferenceId: rootId }] },
    select: lineageSelect,
  });

  const viewerEvents =
    viewerId && lineage.length
      ? await db.bloodlineCardEvent.findMany({
          where: viewerEventWhere(
            lineage.map((card) => card.id),
            viewerId
          ),
          select: viewerEventSelect,
        })
      : [];

  return visibilityFromRows(rootId, viewerId, lineage, viewerEvents);
}

export interface BloodlineVisibilityBatch {
  /** 뿌리 id → 마스킹 문맥 */
  visibilities: Map<number, BloodlineVisibility>;
  /** 뿌리 id → 뿌리 상태(뿌리 행이 없으면 키 없음). 숨김·회수된 혈통의 출처 카드를 목록에서 빼는 데 쓴다 */
  rootStatuses: Map<number, string>;
}

/**
 * 뿌리 여러 개의 마스킹 문맥을 쿼리 2번으로 만든다(loadBloodlineVisibility 의 묶음판, 프로필 목록용).
 * 규칙은 loadBloodlineVisibility 와 같다.
 */
export async function loadBloodlineVisibilities(
  rootIds: ReadonlyArray<number>,
  viewerId?: number | null,
  db: Db = client
): Promise<BloodlineVisibilityBatch> {
  const visibilities = new Map<number, BloodlineVisibility>();
  const rootStatuses = new Map<number, string>();
  const ids = Array.from(new Set(rootIds));
  if (!ids.length) return { visibilities, rootStatuses };

  const lineage = await db.bloodlineCard.findMany({
    where: { OR: [{ id: { in: ids } }, { bloodlineReferenceId: { in: ids } }] },
    select: { ...lineageSelect, bloodlineReferenceId: true },
  });

  const viewerEvents =
    viewerId && lineage.length
      ? await db.bloodlineCardEvent.findMany({
          where: viewerEventWhere(
            lineage.map((card) => card.id),
            viewerId
          ),
          select: { ...viewerEventSelect, cardId: true },
        })
      : [];

  for (const rootId of ids) {
    const members = lineage.filter((card) => card.id === rootId || card.bloodlineReferenceId === rootId);
    const memberIds = new Set(members.map((card) => card.id));
    const root = members.find((card) => card.id === rootId);
    if (root) rootStatuses.set(rootId, root.status);
    visibilities.set(
      rootId,
      visibilityFromRows(
        rootId,
        viewerId,
        members,
        viewerEvents.filter((event) => memberIds.has(event.cardId))
      )
    );
  }
  return { visibilities, rootStatuses };
}
