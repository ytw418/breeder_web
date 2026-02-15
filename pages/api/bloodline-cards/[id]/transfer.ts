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

  const parsedCardId = Number(req.query.id);
  const { toUserName, receiverNickName, receiverName, note = "" } = req.body || {};
  const parsedToUserName = String(toUserName || receiverNickName || receiverName || "").trim();
  const parsedNote = String(note || "").trim().slice(0, 300);

  if (!parsedCardId || Number.isNaN(parsedCardId)) {
    return res.status(400).json({
      success: false,
      error: "유효한 혈통카드 ID가 필요합니다.",
    });
  }

  if (!parsedToUserName) {
    return res.status(400).json({
      success: false,
      error: "받는 사람 닉네임을 입력해주세요.",
    });
  }

  try {
    await ensureBloodlineSchema();
    const transferCard = async () => {
      const [card, targetUser] = await Promise.all([
        client.bloodlineCard.findUnique({
          where: {
            id: parsedCardId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            cardType: true,
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

      if (!targetUser) {
        return "target-not-found" as const;
      }

      if (targetUser.status !== "ACTIVE") {
        return "target-inactive" as const;
      }

      if (targetUser.id === userId) {
        return "self-transfer" as const;
      }

      const isCreator = card.creatorId === userId;
      const isCurrentOwner = card.currentOwnerId === userId;
      const isBloodline = card.cardType === "BLOODLINE";
      const canTransfer =
        isBloodline
          ? isCurrentOwner && isCreator
          : isCurrentOwner;

      if (!canTransfer) {
        return "forbidden" as const;
      }

      await client.$transaction(async (tx) => {
        await tx.bloodlineCard.update({
          where: { id: card.id },
          data: {
            currentOwnerId: targetUser.id,
            transferCount: { increment: 1 },
          },
        });

        await tx.bloodlineCardTransfer.create({
          data: {
            cardId: card.id,
            fromUserId: userId,
            toUserId: targetUser.id,
            note: parsedNote || null,
          },
        });

        await tx.bloodlineCardEvent.create({
          data: {
            cardId: card.id,
            action: isBloodline ? "BLOODLINE_TRANSFER" : "LINE_TRANSFER",
            actorUserId: userId,
            fromUserId: userId,
            toUserId: targetUser.id,
            note: parsedNote || `${isBloodline ? "혈통카드" : "라인카드"} 보내기`,
          },
        });
      });

      return "success" as const;
    };

    const transferResult = await transferCard();

    if (transferResult === "not-found") {
      return res.status(404).json({
        success: false,
        error: "혈통카드를 찾을 수 없습니다.",
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
        error: "해당 유저는 현재 카드를 받을 수 없습니다.",
      });
    }
    if (transferResult === "self-transfer") {
      return res.status(400).json({
        success: false,
        error: "본인에게는 보낼 수 없습니다.",
      });
    }
    if (transferResult === "forbidden") {
      return res.status(403).json({
        success: false,
        error: "해당 카드의 현재 권한으로는 보내기 불가능합니다.",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    const resolved = resolveBloodlineApiError(error, "카드 보내기 처리에 실패했습니다.");
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
