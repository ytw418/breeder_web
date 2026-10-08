import { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { DELETED_USER_LABEL } from "@libs/shared/deletedUser";
import { formatRegionShort } from "@libs/shared/regions";
import { parsePedigreeNote, type PedigreeNote } from "@libs/shared/pedigree-note";
import type { BloodlineLinkSummary } from "@libs/shared/bloodline-card";

/**
 * 상품·경매에 혈통을 붙이는 권한과 상세 요약(설계 §3.5·§3.6).
 * - 권한: ACTIVE BLOODLINE 이고 (지금 보유자 = 나) 또는 (그 뿌리의 ACTIVE 출처 카드를 내가 보유).
 *   만든 사람이라도 혈통을 넘긴 뒤에는 못 붙인다(이전 보유자 권한 제거와 같은 원칙).
 * - 요약은 뷰어와 무관하다(웹 SSR 비로그인 fetch 와 같은 결과). ACTIVE 가 아니면 null → 상세에서 행이 사라진다.
 */

type Db = typeof client | Prisma.TransactionClient;

export type AttachBloodlineDecision =
  | { ok: true; relation: "mine" }
  | { ok: true; relation: "received"; lineCardId: number }
  | { ok: false; reason: "not_found" | "forbidden" };

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/** 그 뿌리의 ACTIVE 출처 카드 중 사용자가 가진 것(가장 먼저 받은 것). */
const findHeldSourceCard = (db: Db, rootId: number, userId: number) =>
  db.bloodlineCard.findFirst({
    where: { cardType: "LINE", bloodlineReferenceId: rootId, status: "ACTIVE", currentOwnerId: userId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

/**
 * 붙이기 권한. not_found → 상품 400 PRODUCT_INVALID_BLOODLINE_ROOT / 경매 400 AUCTION_INVALID_BLOODLINE_ROOT,
 * forbidden → 403 PRODUCT_BLOODLINE_FORBIDDEN / AUCTION_BLOODLINE_FORBIDDEN.
 * relation 은 계측(`*_bloodline_attached` 의 relation)에 쓴다.
 * 경매 낙찰자 제안의 winnerReceived 도 `(await canAttachBloodline(rootId, winnerId)).ok` 로 계산한다.
 */
export async function canAttachBloodline(
  rootId: number,
  userId: number,
  db: Db = client
): Promise<AttachBloodlineDecision> {
  if (!isPositiveInt(rootId)) return { ok: false, reason: "not_found" };
  const root = await db.bloodlineCard.findFirst({
    where: { id: rootId, cardType: "BLOODLINE", status: "ACTIVE" },
    select: { id: true, currentOwnerId: true },
  });
  if (!root) return { ok: false, reason: "not_found" };
  if (root.currentOwnerId === userId) return { ok: true, relation: "mine" };
  const line = await findHeldSourceCard(db, rootId, userId);
  if (line) return { ok: true, relation: "received", lineCardId: line.id };
  return { ok: false, reason: "forbidden" };
}

/**
 * 상품·경매 상세의 혈통 요약. 판매자 관계:
 * creator = 판매자가 만든 혈통 / holder = 남이 만든 혈통을 넘겨받아 보유 / received = 출처 카드 보유 / none = 지금은 관계 없음.
 */
export async function getBloodlineLinkSummary(
  rootId: number | null | undefined,
  sellerId: number,
  db: Db = client
): Promise<BloodlineLinkSummary | null> {
  if (!isPositiveInt(rootId)) return null;
  const root = await db.bloodlineCard.findFirst({
    where: { id: rootId, cardType: "BLOODLINE", status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      speciesType: true,
      originSido: true,
      originSigungu: true,
      creatorId: true,
      currentOwnerId: true,
      creator: { select: { id: true, name: true } },
    },
  });
  if (!root) return null;

  let sellerRelation: BloodlineLinkSummary["sellerRelation"] = "none";
  let receivedAt: string | null = null;
  if (root.creatorId === sellerId) {
    sellerRelation = "creator";
  } else if (root.currentOwnerId === sellerId) {
    sellerRelation = "holder";
  } else {
    const line = await db.bloodlineCard.findFirst({
      where: { cardType: "LINE", bloodlineReferenceId: rootId, status: "ACTIVE", currentOwnerId: sellerId },
      select: { id: true, transferCount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (line) {
      sellerRelation = "received";
      let receivedDate = line.createdAt;
      if (line.transferCount > 0) {
        // 다음 분에게 보내기로 넘겨받았으면 마지막으로 받은 날
        const transfer = await db.bloodlineCardTransfer.findFirst({
          where: { cardId: line.id, toUserId: sellerId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (transfer) receivedDate = transfer.createdAt;
      }
      receivedAt = receivedDate.toISOString();
    }
  }

  return {
    id: root.id,
    name: root.name,
    speciesType: root.speciesType,
    originLabel: formatRegionShort({ sido: root.originSido, sigungu: root.originSigungu }),
    creator: { id: root.creator?.id ?? root.creatorId, name: root.creator?.name ?? DELETED_USER_LABEL },
    sellerRelation,
    receivedAt,
  };
}

/** Prisma Json 칼럼에 넣을 값. null 이면 DB NULL(Prisma.DbNull). */
export function pedigreeNoteDbValue(
  note: PedigreeNote | null
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!note) return Prisma.DbNull;
  return { ...note } as Prisma.InputJsonValue;
}

/** 저장된 Json 을 규칙에 맞는 키만 남겨 읽는다. 규칙 밖이면 null. */
export function readStoredPedigreeNote(value: Prisma.JsonValue | null | undefined): PedigreeNote | null {
  const parsed = parsePedigreeNote(value);
  return parsed.ok ? parsed.value : null;
}
