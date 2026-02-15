import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import {
  BloodlineCardItem,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import { resolveBloodlineApiError } from "@libs/server/bloodline-error";
import { ensureBloodlineSchema } from "@libs/server/bloodline-schema";

const toCardItem = (card: {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  creator: { id: number; name: string };
  currentOwner: { id: number; name: string };
  createdAt: Date;
  updatedAt: Date;
  transfers: {
    id: number;
    fromUser: { id: number; name: string } | null;
    toUser: { id: number; name: string };
    note: string | null;
    createdAt: Date;
  }[];
}): BloodlineCardItem => ({
  id: card.id,
  name: card.name,
  description: card.description,
  image: card.image,
  creator: card.creator,
  currentOwner: card.currentOwner,
  createdAt: card.createdAt.toISOString(),
  updatedAt: card.updatedAt.toISOString(),
  transfers: card.transfers.map((transfer) => ({
    id: transfer.id,
    fromUser: transfer.fromUser,
    toUser: transfer.toUser,
    note: transfer.note,
    createdAt: transfer.createdAt.toISOString(),
  })),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardsResponse>
) {
  const userId = req.session.user?.id;
  const userName = String(req.session.user?.name || "").trim();

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      createdCard: null,
      ownedCards: [],
    });
  }

  if (req.method === "GET") {
    try {
      const loadCards = async () =>
        Promise.all([
          client.bloodlineCard.findUnique({
            where: { creatorId: userId },
            include: {
              creator: { select: { id: true, name: true } },
              currentOwner: { select: { id: true, name: true } },
              transfers: {
                orderBy: { createdAt: "desc" },
                take: 5,
                include: {
                  fromUser: { select: { id: true, name: true } },
                  toUser: { select: { id: true, name: true } },
                },
              },
            },
          }),
          client.bloodlineCard.findMany({
            where: {
              OR: [
                { creatorId: userId },
                { transfers: { some: { toUserId: userId } } },
              ],
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            distinct: ["id"],
            include: {
              creator: { select: { id: true, name: true } },
              currentOwner: { select: { id: true, name: true } },
              transfers: {
                orderBy: { createdAt: "desc" },
                take: 5,
                include: {
                  fromUser: { select: { id: true, name: true } },
                  toUser: { select: { id: true, name: true } },
                },
              },
            },
          }),
        ]);

      let createdCard;
      let ownedCards;
      try {
        [createdCard, ownedCards] = await loadCards();
      } catch (error) {
        const resolved = resolveBloodlineApiError(
          error,
          "혈통카드 정보를 불러오지 못했습니다."
        );
        if (resolved.status !== 503) {
          throw error;
        }
        await ensureBloodlineSchema();
        [createdCard, ownedCards] = await loadCards();
      }

      return res.json({
        success: true,
        createdCard: createdCard ? toCardItem(createdCard) : null,
        ownedCards: ownedCards.map(toCardItem),
      });
    } catch (error) {
      const resolved = resolveBloodlineApiError(
        error,
        "혈통카드 정보를 불러오지 못했습니다."
      );
      console.error("[bloodline-cards][GET]", error);
      return res.status(resolved.status).json({
        success: false,
        error: resolved.message,
        createdCard: null,
        ownedCards: [],
      });
    }
  }

  if (req.method === "POST") {
    const { name, description = "", image = "" } = req.body || {};
    const parsedName = String(name || `${userName || "브리더"} 혈통`)
      .trim()
      .slice(0, 40);
    const parsedDescription = String(description || "").trim().slice(0, 300);
    const parsedImage = String(image || "").trim().slice(0, 200);

    if (parsedName.length < 2) {
      return res.status(400).json({
        success: false,
        error: "카드 이름은 2자 이상 입력해주세요.",
        createdCard: null,
        ownedCards: [],
      });
    }

    try {
      const createCard = async () => {
        const existing = await client.bloodlineCard.findUnique({
          where: { creatorId: userId },
          select: { id: true },
        });
        if (existing) {
          return "already-exists" as const;
        }

        return client.$transaction(async (tx) => {
          const card = await tx.bloodlineCard.create({
            data: {
              creatorId: userId,
              currentOwnerId: userId,
              name: parsedName,
              description: parsedDescription || null,
              image: parsedImage || null,
            },
            include: {
              creator: { select: { id: true, name: true } },
              currentOwner: { select: { id: true, name: true } },
              transfers: {
                orderBy: { createdAt: "desc" },
                take: 5,
                include: {
                  fromUser: { select: { id: true, name: true } },
                  toUser: { select: { id: true, name: true } },
                },
              },
            },
          });

          await tx.bloodlineCardTransfer.create({
            data: {
              cardId: card.id,
              fromUserId: null,
              toUserId: userId,
              note: "혈통카드 생성",
            },
          });

          return tx.bloodlineCard.findUnique({
            where: { id: card.id },
            include: {
              creator: { select: { id: true, name: true } },
              currentOwner: { select: { id: true, name: true } },
              transfers: {
                orderBy: { createdAt: "desc" },
                take: 5,
                include: {
                  fromUser: { select: { id: true, name: true } },
                  toUser: { select: { id: true, name: true } },
                },
              },
            },
          });
        });
      };

      let created;
      try {
        created = await createCard();
      } catch (error) {
        const resolved = resolveBloodlineApiError(
          error,
          "혈통카드 생성에 실패했습니다."
        );
        if (resolved.status !== 503) {
          throw error;
        }
        await ensureBloodlineSchema();
        created = await createCard();
      }

      if (created === "already-exists") {
        return res.status(409).json({
          success: false,
          error: "대표 혈통카드는 유저당 1개만 생성할 수 있습니다.",
          createdCard: null,
          ownedCards: [],
        });
      }

      if (!created) {
        return res.status(500).json({
          success: false,
          error: "혈통카드 생성에 실패했습니다.",
          createdCard: null,
          ownedCards: [],
        });
      }

      return res.json({
        success: true,
        createdCard: toCardItem(created),
        ownedCards: [toCardItem(created)],
      });
    } catch (error) {
      const resolved = resolveBloodlineApiError(
        error,
        "혈통카드 생성에 실패했습니다."
      );
      console.error("[bloodline-cards][POST]", error);
      return res.status(resolved.status).json({
        success: false,
        error: resolved.message,
        createdCard: null,
        ownedCards: [],
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: "지원하지 않는 메서드입니다.",
    createdCard: null,
    ownedCards: [],
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
