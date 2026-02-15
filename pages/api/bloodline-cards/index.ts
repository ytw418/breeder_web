import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import {
  BloodlineCardItem,
  BloodlineCardVisualStyle,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import {
  resolveBloodlineApiError,
} from "@libs/server/bloodline-error";
import { ensureBloodlineSchema } from "@libs/server/bloodline-schema";

interface TransferInfo {
  id: number;
  fromUser: { id: number; name: string } | null;
  toUser: { id: number; name: string };
  note: string | null;
  createdAt: Date;
}

interface BloodlineCardWithRelations {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  cardType: "BLOODLINE" | "LINE";
  speciesType: string | null;
  bloodlineReferenceId: number | null;
  parentCardId: number | null;
  status: "ACTIVE" | "INACTIVE" | "REVOKED";
  transferPolicy: "NONE" | "ONE_TIME" | "LIMITED_CHAIN" | "LIMITED_COUNT" | "VERIFIED_ONLY";
  issueCount: number;
  transferCount: number;
  creator: { id: number; name: string };
  currentOwner: { id: number; name: string };
  createdAt: Date;
  updatedAt: Date;
  transfers: TransferInfo[];
}

type RawVisualStyleRow = {
  id: number;
  visualStyle: string | null;
};

const bloodlineVisualStyles = ["noir", "clean", "editorial"] as const;

type LoadCardResult = {
  myBloodlines: BloodlineCardWithRelations[];
  receivedBloodlines: BloodlineCardWithRelations[];
  createdLines: BloodlineCardWithRelations[];
  receivedLines: BloodlineCardWithRelations[];
  ownedCards: BloodlineCardWithRelations[];
  visualStyleMap: Map<number, BloodlineCardVisualStyle>;
};

const isVisualStyle = (value: unknown): value is BloodlineCardVisualStyle => {
  return (
    typeof value === "string" &&
    (bloodlineVisualStyles as readonly string[]).includes(value)
  );
};

const normalizeVisualStyle = (value: unknown): BloodlineCardVisualStyle => {
  return isVisualStyle(value) ? value : "noir";
};

const baseResponse: BloodlineCardsResponse = {
  success: true,
  myBloodlines: [],
  receivedBloodlines: [],
  createdLines: [],
  receivedLines: [],
  myCreatedCards: [],
  receivedCards: [],
  ownedCards: [],
};

const toCardItem = (
  card: BloodlineCardWithRelations,
  visualStyleMap: Map<number, BloodlineCardVisualStyle>
): BloodlineCardItem => ({
  id: card.id,
  name: card.name,
  description: card.description,
  image: card.image,
  cardType: card.cardType,
  speciesType: card.speciesType,
  bloodlineReferenceId: card.bloodlineReferenceId,
  parentCardId: card.parentCardId,
  status: card.status,
  transferPolicy: card.transferPolicy,
  issueCount: card.issueCount,
  transferCount: card.transferCount,
  creator: card.creator,
  currentOwner: card.currentOwner,
  createdAt: card.createdAt.toISOString(),
  updatedAt: card.updatedAt.toISOString(),
  transfers: card.transfers.map((transfer) => ({
    ...transfer,
    createdAt: transfer.createdAt.toISOString(),
  })),
  visualStyle: visualStyleMap.get(card.id),
});

const includeWithTransfers = {
  creator: { select: { id: true, name: true } },
  currentOwner: { select: { id: true, name: true } },
  transfers: {
    orderBy: { createdAt: "desc" } as const,
    take: 5,
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
  },
};

const fetchVisualStyles = async (cardIds: number[]) => {
  if (!cardIds.length) {
    return new Map<number, BloodlineCardVisualStyle>();
  }

  const rows = await client.$queryRaw<RawVisualStyleRow[]>`
    SELECT id, "visualStyle"
    FROM "BloodlineCard"
    WHERE id IN (${Prisma.join(cardIds)})
  `;

  const visualStyleMap = rows.reduce((acc, row) => {
    acc.set(row.id, normalizeVisualStyle(row.visualStyle));
    return acc;
  }, new Map<number, BloodlineCardVisualStyle>());

  return visualStyleMap;
};

const loadCards = async (userId: number): Promise<LoadCardResult> => {
  const [myBloodlines, receivedBloodlines, createdLines, receivedLines, ownedCards] =
    await Promise.all([
      client.bloodlineCard.findMany({
        where: {
          creatorId: userId,
          cardType: "BLOODLINE",
          status: "ACTIVE",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: includeWithTransfers,
      }),
      client.bloodlineCard.findMany({
        where: {
          cardType: "BLOODLINE",
          status: "ACTIVE",
          currentOwnerId: userId,
          creatorId: { not: userId },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: includeWithTransfers,
      }),
      client.bloodlineCard.findMany({
        where: {
          creatorId: userId,
          cardType: "LINE",
          status: "ACTIVE",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: includeWithTransfers,
      }),
      client.bloodlineCard.findMany({
        where: {
          cardType: "LINE",
          status: "ACTIVE",
          currentOwnerId: userId,
          creatorId: { not: userId },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: includeWithTransfers,
      }),
      client.bloodlineCard.findMany({
        where: {
          status: "ACTIVE",
          currentOwnerId: userId,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: includeWithTransfers,
      }),
    ]);

  const visualStyleMap = await fetchVisualStyles(
    Array.from(
      new Set(
        [...myBloodlines, ...receivedBloodlines, ...createdLines, ...receivedLines, ...ownedCards].map(
          (card) => card.id
        )
      )
    )
  );

  return {
    myBloodlines,
    receivedBloodlines,
    createdLines,
    receivedLines,
    ownedCards,
    visualStyleMap,
  };
};

const loadCreateModeCards = async (userId: number): Promise<LoadCardResult> => {
  const myBloodlines = await client.bloodlineCard.findMany({
    where: {
      creatorId: userId,
      currentOwnerId: userId,
      cardType: "BLOODLINE",
      status: "ACTIVE",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: includeWithTransfers,
  });

  const visualStyleMap = await fetchVisualStyles(
    myBloodlines.map((card) => card.id)
  );

  return {
    myBloodlines,
    receivedBloodlines: [],
    createdLines: [],
    receivedLines: [],
    ownedCards: myBloodlines,
    visualStyleMap,
  };
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardsResponse>
) {
  const userId = req.session.user?.id;
  const userName = String(req.session.user?.name || "").trim();

  if (!userId) {
    return res.status(401).json({
      ...baseResponse,
      success: false,
      error: "로그인이 필요합니다.",
    });
  }

  if (req.method === "GET") {
    try {
      await ensureBloodlineSchema();
      const mode =
        typeof req.query.mode === "string" ? req.query.mode.toLowerCase() : "";
      const lists =
        mode === "create" ? await loadCreateModeCards(userId) : await loadCards(userId);

      const myBloodlines = lists.myBloodlines.map((card) => toCardItem(card, lists.visualStyleMap));
      const receivedBloodlines = lists.receivedBloodlines.map((card) =>
        toCardItem(card, lists.visualStyleMap)
      );
      const createdLines = lists.createdLines.map((card) => toCardItem(card, lists.visualStyleMap));
      const receivedLines = lists.receivedLines.map((card) => toCardItem(card, lists.visualStyleMap));
      const ownedCards = lists.ownedCards.map((card) => toCardItem(card, lists.visualStyleMap));

      return res.json({
        ...baseResponse,
        myBloodlines,
        receivedBloodlines,
        createdLines,
        receivedLines,
        myCreatedCards: [...myBloodlines],
        receivedCards: [...receivedBloodlines, ...receivedLines],
        ownedCards,
      });
    } catch (error) {
      const resolved = resolveBloodlineApiError(
        error,
        "혈통카드 정보를 불러오지 못했습니다."
      );
      console.error("[bloodline-cards][GET]", error);
      return res.status(resolved.status).json({
        ...baseResponse,
        success: false,
        error: resolved.message,
      });
    }
  }

  if (req.method === "POST") {
    const {
      name,
      description = "",
      image = "",
      speciesType = "",
      transferPolicy = "NONE",
      visualStyle,
    } = req.body || {};

    const parsedName = String(name || `${userName || "브리더"} 혈통`)
      .trim()
      .slice(0, 40);
    const parsedDescription = String(description || "").trim().slice(0, 300);
    const parsedImage = String(image || "").trim().slice(0, 200);
    const parsedSpeciesType = String(speciesType || "").trim().slice(0, 60);
    const parsedTransferPolicy = String(transferPolicy).toUpperCase() as
      | "NONE"
      | "ONE_TIME"
      | "LIMITED_CHAIN"
      | "LIMITED_COUNT"
      | "VERIFIED_ONLY";
    const parsedVisualStyle = normalizeVisualStyle(visualStyle);

    if (parsedName.length < 2) {
      return res.status(400).json({
        ...baseResponse,
        success: false,
        error: "카드 이름은 2자 이상 입력해주세요.",
      });
    }

    if (!parsedDescription) {
      return res.status(400).json({
        ...baseResponse,
        success: false,
        error: "카드 설명은 필수 입력 항목입니다.",
      });
    }

    if (
      ![
        "NONE",
        "ONE_TIME",
        "LIMITED_CHAIN",
        "LIMITED_COUNT",
        "VERIFIED_ONLY",
      ].includes(parsedTransferPolicy)
    ) {
      return res.status(400).json({
        ...baseResponse,
        success: false,
        error: "유효하지 않은 전달 정책입니다.",
      });
    }

    try {
      await ensureBloodlineSchema();
      const createCard = async () =>
        client.$transaction(async (tx) => {
          const card = await tx.bloodlineCard.create({
            data: {
              creatorId: userId,
              currentOwnerId: userId,
              cardType: "BLOODLINE",
              speciesType: parsedSpeciesType || null,
              name: parsedName,
              description: parsedDescription || null,
              image: parsedImage || null,
              transferPolicy: parsedTransferPolicy,
            },
            select: {
              id: true,
              name: true,
              description: true,
              image: true,
              cardType: true,
              speciesType: true,
              bloodlineReferenceId: true,
              parentCardId: true,
              status: true,
              transferPolicy: true,
              issueCount: true,
              transferCount: true,
              creatorId: true,
              currentOwnerId: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (parsedVisualStyle !== "noir") {
            await tx.$executeRaw`
              UPDATE "BloodlineCard"
              SET "visualStyle" = ${parsedVisualStyle}
              WHERE id = ${card.id}
            `;
          }

          await tx.bloodlineCardTransfer.create({
            data: {
              cardId: card.id,
              fromUserId: null,
              toUserId: userId,
              note: "혈통카드 생성",
            },
          });

          await tx.bloodlineCardEvent.create({
            data: {
              cardId: card.id,
              action: "BLOODLINE_CREATED",
              actorUserId: userId,
              toUserId: userId,
              note: parsedDescription || "혈통카드를 생성했습니다.",
            },
          });

          return card;
        });

      const created = await createCard();

      if (!created) {
        return res.status(500).json({
          ...baseResponse,
          success: false,
          error: "혈통카드 생성에 실패했습니다.",
        });
      }

      const creatorName = userName || "브리더";
      const bloodlineCard: BloodlineCardItem = {
        id: created.id,
        name: created.name,
        description: created.description,
        image: created.image,
        cardType: created.cardType,
        speciesType: created.speciesType,
        bloodlineReferenceId: created.bloodlineReferenceId ?? null,
        parentCardId: created.parentCardId ?? null,
        status: created.status,
        transferPolicy: created.transferPolicy,
        issueCount: created.issueCount ?? 0,
        transferCount: created.transferCount ?? 0,
        creator: {
          id: created.creatorId,
          name: creatorName,
        },
        currentOwner: {
          id: created.currentOwnerId,
          name: creatorName,
        },
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        transfers: [],
        visualStyle: parsedVisualStyle,
      };
      return res.json({
        ...baseResponse,
        success: true,
        myBloodlines: [bloodlineCard],
        receivedBloodlines: [],
        createdLines: [],
        receivedLines: [],
        myCreatedCards: [bloodlineCard],
        receivedCards: [],
        ownedCards: [bloodlineCard],
      });
    } catch (error) {
      const resolved = resolveBloodlineApiError(
        error,
        "혈통카드 생성에 실패했습니다."
      );
      console.error("[bloodline-cards][POST]", error);
      return res.status(resolved.status).json({
        ...baseResponse,
        success: false,
        error: resolved.message,
      });
    }
  }

  return res.status(405).json({
    ...baseResponse,
    success: false,
    error: "지원하지 않는 메서드입니다.",
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
