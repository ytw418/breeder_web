import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { BloodlineCardTransferResponse } from "@libs/shared/bloodline-card";
import { resolveBloodlineApiError } from "@libs/server/bloodline-error";
import { ensureBloodlineSchema } from "@libs/server/bloodline-schema";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardTransferResponse>
) {
  const userId = req.session.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
    });
  }

  const { cardId, toUserName, note = "" } = req.body || {};
  const parsedCardId = Number(cardId);
  const parsedToUserName = String(toUserName || "").trim();
  const parsedNote = String(note || "").trim().slice(0, 300);

  if (!parsedCardId || Number.isNaN(parsedCardId)) {
    return res.status(400).json({
      success: false,
      error: "유효한 혈통카드 ID가 필요합니다.",
    });
  }

  if (parsedToUserName.length < 2) {
    return res.status(400).json({
      success: false,
      error: "받는 사람 닉네임을 입력해주세요.",
    });
  }

  try {
    const transferCard = async () => {
      const [card, targetUser] = await Promise.all([
        client.bloodlineCard.findUnique({
          where: { id: parsedCardId },
          select: {
            id: true,
            creatorId: true,
            currentOwnerId: true,
          },
        }),
        client.user.findUnique({
          where: { name: parsedToUserName },
          select: { id: true, status: true },
        }),
      ]);

      if (!card) {
        return "not-found" as const;
      }

      if (card.creatorId !== userId) {
        return "forbidden" as const;
      }

      if (!targetUser) {
        return "target-not-found" as const;
      }

      if (targetUser.status !== "ACTIVE") {
        return "target-inactive" as const;
      }

      if (targetUser.id === userId) {
        return "self-transfer" as const;
      }

      await client.bloodlineCardTransfer.create({
        data: {
          cardId: card.id,
          fromUserId: userId,
          toUserId: targetUser.id,
          note: parsedNote || null,
        },
      });

      return "success" as const;
    };

    let transferResult;
    try {
      transferResult = await transferCard();
    } catch (error) {
      const resolved = resolveBloodlineApiError(error, "카드 전달에 실패했습니다.");
      if (resolved.status !== 503) {
        throw error;
      }
      await ensureBloodlineSchema();
      transferResult = await transferCard();
    }

    if (transferResult === "not-found") {
      return res.status(404).json({
        success: false,
        error: "혈통카드를 찾을 수 없습니다.",
      });
    }

    if (transferResult === "forbidden") {
      return res.status(403).json({
        success: false,
        error: "혈통카드 최초 생성자만 전달할 수 있습니다.",
      });
    }

    if (transferResult === "target-not-found") {
      return res.status(404).json({
        success: false,
        error: "받는 사람 닉네임을 찾을 수 없습니다.",
      });
    }

    if (transferResult === "target-inactive") {
      return res.status(400).json({
        success: false,
        error: "해당 유저는 현재 카드를 받을 수 없는 상태입니다.",
      });
    }

    if (transferResult === "self-transfer") {
      return res.status(400).json({
        success: false,
        error: "본인에게는 전달할 수 없습니다.",
      });
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    const resolved = resolveBloodlineApiError(error, "카드 전달에 실패했습니다.");
    console.error("[bloodline-cards][POST transfer]", error);
    return res.status(resolved.status).json({
      success: false,
      error: resolved.message,
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
