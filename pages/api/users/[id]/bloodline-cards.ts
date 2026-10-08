import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import { fetchReceivedCounts, toBloodlineCardItem } from "@libs/server/bloodline-mapper";
import {
  isProfileBloodlineCardShown,
  loadBloodlineVisibilities,
  profileBloodlineCardWhere,
  rootIdOf,
} from "@libs/server/bloodline-visibility";
import { BloodlineCardItem } from "@libs/shared/bloodline-card";

/**
 * 프로필 "보유 혈통" 목록(공개) — 설계 §3.4.
 * - 지금 그 사용자가 보유한(currentOwnerId) ACTIVE 카드만. 만든 사람·이전 보유자 기준이 아니다
 *   (프로필 뱃지 `_count.ownedBloodlineCards` 와 같은 기준).
 * - 출처 카드(LINE)는 보유자가 닉네임 공개를 켰거나(ownerNameVisible) 본인이 볼 때만 넣는다.
 *   프로필 경로로 받은 사람 명단이 새지 않게 하려는 것이다.
 * - 뿌리 혈통이 숨김·회수(ACTIVE 아님)된 출처 카드는 뺀다. 그 카드 상세는 404 BLOODLINE_REVOKED 라 열 수 없다.
 * - 사람(creator·currentOwner)은 상세와 같은 닉네임 비공개 규칙으로 가린다. 혈통에는 receivedCount 를 싣는다.
 */

export interface UserBloodlineCardsResponse {
  success: boolean;
  cards: BloodlineCardItem[];
  error?: string;
  errorCode?: string;
}

const userSelect = { select: { id: true, name: true } } as const;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserBloodlineCardsResponse>
) {
  const userId = Number(req.query.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", {
      message: "사용자를 찾을 수 없어요",
      body: { cards: [] },
    });
  }
  const viewerId = req.user?.id ?? null;

  try {
    const owned = await client.bloodlineCard.findMany({
      where: profileBloodlineCardWhere(userId, viewerId),
      include: { creator: userSelect, currentOwner: userSelect },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    const bloodlines = owned.filter((card) => card.cardType === "BLOODLINE");
    const [{ visibilities, rootStatuses }, receivedCounts] = await Promise.all([
      loadBloodlineVisibilities(owned.map(rootIdOf), viewerId),
      fetchReceivedCounts(bloodlines.map((card) => ({ id: card.id, creatorId: card.creatorId }))),
    ]);
    // 뱃지 수(countProfileBloodlineCards)와 같은 판정
    const cards = owned.filter((card) => isProfileBloodlineCardShown(card, rootStatuses));

    return res.json({
      success: true,
      cards: cards.map((card) =>
        toBloodlineCardItem(card, {
          viewerId,
          visibility: visibilities.get(rootIdOf(card)) ?? null,
          ...(card.cardType === "BLOODLINE" ? { receivedCount: receivedCounts.get(card.id) ?? 0 } : {}),
        })
      ),
    });
  } catch (error) {
    console.error("[users][bloodline-cards][GET]", error);
    return sendResolvedBloodlineError(res, error, "보유 혈통을 불러오지 못했어요", { cards: [] });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
