import { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { DELETED_USER_LABEL } from "@libs/shared/deletedUser";
import { formatRegionShort } from "@libs/shared/regions";
import type {
  BloodlineCardItem,
  BloodlineCardStatus,
  BloodlineCardTransferPolicy,
  BloodlineCardType,
  BloodlineUserRef,
} from "@libs/shared/bloodline-card";
import {
  canSeeBloodlineCardMemo,
  canSeeBloodlineTransferNote,
  type BloodlineVisibility,
} from "@libs/server/bloodline-visibility";

/**
 * 혈통 카드 → 응답 항목(BloodlineCardItem) 공용 mapper. 목록·상세·보내기·프로필 4곳에 복제돼 있던 것을 합친다.
 * - visualStyle 은 렌더에 쓰지 않아 항상 "noir" 로 준다(타입 호환).
 * - 사용자(creator·currentOwner·transfers[].fromUser/toUser)는 visibility 가 있으면 마스킹 규칙을 적용한다.
 * - 관계가 비어 있으면(탈퇴 등) { id: 0, name: "탈퇴한 사용자" }.
 * - 메모는 뷰어 기준으로 거른다(viewerId 가 없으면 비로그인으로 본다): 출처 카드의 description(보낼 때 쓴 메모)은
 *   지금 보유자·보낸 사람(creator)만, transfers[].note 는 그 넘기기의 보낸 사람·받은 사람만 본다.
 *   혈통(BLOODLINE)의 description 은 공개 소개라 그대로 둔다.
 */

type Db = typeof client | Prisma.TransactionClient;

const userSelect = { id: true, name: true } as const;

/** 목록·상세에서 쓰는 include(최근 이동 5건 포함). */
export const bloodlineCardInclude = {
  creator: { select: userSelect },
  currentOwner: { select: userSelect },
  transfers: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    include: {
      fromUser: { select: userSelect },
      toUser: { select: userSelect },
    },
  },
} satisfies Prisma.BloodlineCardInclude;

export type BloodlineCardWithRelations = Prisma.BloodlineCardGetPayload<{
  include: typeof bloodlineCardInclude;
}>;

type UserRow = { id: number; name: string } | null | undefined;

/** Prisma include 결과와 raw SQL 행(프로필)을 모두 받을 수 있는 느슨한 입력. */
export interface BloodlineCardRowLike {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  cardType: BloodlineCardType | string;
  speciesType: string | null;
  bloodlineReferenceId: number | null;
  parentCardId: number | null;
  status: BloodlineCardStatus | string;
  transferPolicy: BloodlineCardTransferPolicy | string;
  issueCount: number;
  transferCount: number;
  createdAt: Date;
  updatedAt: Date;
  originSido?: string | null;
  originSigungu?: string | null;
  ownerNameVisible?: boolean | null;
  currentOwnerId?: number | null;
  creatorId?: number | null;
  creator: UserRow;
  currentOwner: UserRow;
  transfers?: Array<{
    id: number;
    fromUserId?: number | null;
    toUserId?: number | null;
    fromUser: UserRow;
    toUser: UserRow;
    note: string | null;
    createdAt: Date;
  }>;
}

export interface ToBloodlineCardItemOptions {
  /** 뷰어 id. isOwnedByMe·ownerNameVisible·메모 공개 판단에 쓴다(없으면 비로그인) */
  viewerId?: number | null;
  /** isOwnedByMe 를 직접 정할 때(목록처럼 이미 보유 집합이 있을 때) */
  isOwnedByMe?: boolean;
  /** 마스킹 문맥(loadBloodlineVisibility). 없으면 이름을 그대로 둔다 */
  visibility?: Pick<BloodlineVisibility, "present"> | null;
  /** 뿌리 혈통만 */
  receivedCount?: number;
  /** 뿌리 혈통만 */
  listingCount?: number;
}

const CARD_TYPES: readonly BloodlineCardType[] = ["BLOODLINE", "LINE"];
const CARD_STATUSES: readonly BloodlineCardStatus[] = ["ACTIVE", "INACTIVE", "REVOKED"];
const TRANSFER_POLICIES: readonly BloodlineCardTransferPolicy[] = [
  "NONE",
  "ONE_TIME",
  "LIMITED_CHAIN",
  "LIMITED_COUNT",
  "VERIFIED_ONLY",
];

const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const deletedUser = (): BloodlineUserRef => ({ id: 0, name: DELETED_USER_LABEL });

export function toBloodlineCardItem(
  card: BloodlineCardRowLike,
  options: ToBloodlineCardItemOptions = {}
): BloodlineCardItem {
  const present = (user: UserRow): BloodlineUserRef | null => {
    if (!user) return null;
    return options.visibility ? options.visibility.present(user) : { id: user.id, name: user.name };
  };
  const viewerId = options.viewerId ?? null;
  const ownerId = card.currentOwner?.id ?? card.currentOwnerId ?? null;
  const viewerIsOwner = Boolean(viewerId && ownerId === viewerId);
  const cardType = pick(card.cardType, CARD_TYPES, "BLOODLINE");
  const creatorId = card.creator?.id ?? card.creatorId ?? null;
  const memoVisible = canSeeBloodlineCardMemo(viewerId, { cardType, creatorId, currentOwnerId: ownerId });

  const item: BloodlineCardItem = {
    id: card.id,
    name: card.name,
    description: memoVisible ? card.description : null,
    image: card.image,
    cardType,
    speciesType: card.speciesType,
    bloodlineReferenceId: card.bloodlineReferenceId,
    parentCardId: card.parentCardId,
    status: pick(card.status, CARD_STATUSES, "ACTIVE"),
    transferPolicy: pick(card.transferPolicy, TRANSFER_POLICIES, "NONE"),
    issueCount: card.issueCount,
    transferCount: card.transferCount,
    creator: present(card.creator) ?? deletedUser(),
    currentOwner: present(card.currentOwner) ?? deletedUser(),
    isOwnedByMe: options.isOwnedByMe ?? viewerIsOwner,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    transfers: (card.transfers ?? []).map((transfer) => ({
      id: transfer.id,
      fromUser: present(transfer.fromUser),
      toUser: present(transfer.toUser) ?? deletedUser(),
      note: canSeeBloodlineTransferNote(viewerId, {
        fromUserId: transfer.fromUser?.id ?? transfer.fromUserId ?? null,
        toUserId: transfer.toUser?.id ?? transfer.toUserId ?? null,
      })
        ? transfer.note
        : null,
      createdAt: transfer.createdAt.toISOString(),
    })),
    visualStyle: "noir",
    originSido: card.originSido ?? null,
    originSigungu: card.originSigungu ?? null,
    originLabel: formatRegionShort({ sido: card.originSido, sigungu: card.originSigungu }),
  };

  if (cardType === "LINE" && viewerIsOwner) item.ownerNameVisible = Boolean(card.ownerNameVisible);
  if (options.receivedCount !== undefined) item.receivedCount = options.receivedCount;
  if (options.listingCount !== undefined) item.listingCount = options.listingCount;
  return item;
}

/**
 * 받은 사람 수: 서로 다른 현재 보유자 수. 뿌리를 만든 사람이 가진 것과 발급자가 자기에게 둔 것(레거시 본인 발급)은 뺀다.
 * lines 는 같은 뿌리의 ACTIVE 출처 카드만 넘긴다.
 */
export function countReceivedOwners(
  lines: ReadonlyArray<{ currentOwnerId: number; creatorId: number }>,
  rootCreatorId: number
): number {
  const owners = new Set<number>();
  for (const line of lines) {
    if (line.currentOwnerId === rootCreatorId || line.currentOwnerId === line.creatorId) continue;
    owners.add(line.currentOwnerId);
  }
  return owners.size;
}

/** 뿌리별 receivedCount 를 쿼리 한 번으로. 없는 뿌리는 0. */
export async function fetchReceivedCounts(
  roots: ReadonlyArray<{ id: number; creatorId: number }>,
  db: Db = client
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (!roots.length) return counts;
  const lines = await db.bloodlineCard.findMany({
    where: { cardType: "LINE", status: "ACTIVE", bloodlineReferenceId: { in: roots.map((root) => root.id) } },
    select: { bloodlineReferenceId: true, creatorId: true, currentOwnerId: true },
  });
  for (const root of roots) {
    counts.set(
      root.id,
      countReceivedOwners(
        lines.filter((line) => line.bloodlineReferenceId === root.id),
        root.creatorId
      )
    );
  }
  return counts;
}

/** 뿌리별 listingCount(이 혈통이 붙은 상품 중 삭제·숨김 제외)를 쿼리 한 번으로. 없는 뿌리는 0. */
export async function fetchListingCounts(
  rootIds: readonly number[],
  db: Db = client
): Promise<Map<number, number>> {
  const counts = new Map<number, number>(rootIds.map((id) => [id, 0]));
  if (!rootIds.length) return counts;
  const rows = await db.product.groupBy({
    by: ["bloodlineRootId"],
    where: { bloodlineRootId: { in: [...rootIds] }, isDeleted: false, isHidden: false },
    _count: { _all: true },
  });
  for (const row of rows) {
    if (row.bloodlineRootId !== null) counts.set(row.bloodlineRootId, row._count._all);
  }
  return counts;
}
