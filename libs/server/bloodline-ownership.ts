import { Prisma } from "@prisma/client";
import client from "@libs/server/client";

/**
 * 혈통 카드 소유 판정과 보유자 거울 테이블.
 * - 권한은 `BloodlineCard.currentOwnerId` 한 곳으로 본다. `BloodlineCardOwner` 는 읽지 않는다
 *   (예전에는 이 테이블에 이전 보유자 행이 남아 넘긴 뒤에도 다시 보낼 수 있었다).
 * - `BloodlineCardOwner` 는 currentOwnerId 의 거울로만 유지한다(P2 삭제 후보). 만들 때 addCardOwner,
 *   보유자가 바뀔 때 replaceCardOwner 를 같은 트랜잭션 안에서 부른다.
 */

type Db = typeof client | Prisma.TransactionClient;

/** 사용자가 지금 보유한 카드 id(혈통·출처 카드 모두). */
export const fetchOwnedCardIds = async (userId: number): Promise<Set<number>> => {
  const rows = await client.bloodlineCard.findMany({
    where: { currentOwnerId: userId },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
};

/** 지금 보유자인지(currentOwnerId 만 본다). */
export const isCardOwner = async (cardId: number, userId: number): Promise<boolean> => {
  const row = await client.bloodlineCard.findFirst({
    where: { id: cardId, currentOwnerId: userId },
    select: { id: true },
  });
  return Boolean(row);
};

/** 카드를 만들 때 보유자 행 1개를 넣는다(이미 있으면 건너뛴다). */
export const addCardOwner = async (tx: Db, cardId: number, userId: number): Promise<void> => {
  await tx.bloodlineCardOwner.createMany({
    data: [{ bloodlineCardId: cardId, userId }],
    skipDuplicates: true,
  });
};

/** 보유자가 바뀔 때: 그 카드의 보유자 행을 모두 지우고 새 보유자 1행을 넣는다. */
export const replaceCardOwner = async (tx: Db, cardId: number, userId: number): Promise<void> => {
  await tx.bloodlineCardOwner.deleteMany({ where: { bloodlineCardId: cardId } });
  await tx.bloodlineCardOwner.create({ data: { bloodlineCardId: cardId, userId } });
};
