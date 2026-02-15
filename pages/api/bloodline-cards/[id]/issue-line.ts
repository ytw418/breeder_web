import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { Prisma } from "@prisma/client";
import {
  BloodlineCardIssueLineResponse,
  BloodlineCardItem,
  BloodlineCardVisualStyle,
} from "@libs/shared/bloodline-card";
import { resolveBloodlineApiError } from "@libs/server/bloodline-error";
import { ensureBloodlineSchema } from "@libs/server/bloodline-schema";

interface SourceCard {
  id: number;
  cardType: "BLOODLINE" | "LINE";
  name: string;
  description: string | null;
  image: string | null;
  speciesType: string | null;
  bloodlineReferenceId: number | null;
  currentOwnerId: number;
  status: "ACTIVE" | "INACTIVE" | "REVOKED";
}

const VALID_VISUAL_STYLES = ["noir", "clean", "editorial"] as const;

const isVisualStyle = (value: unknown): value is BloodlineCardVisualStyle =>
  typeof value === "string" && (VALID_VISUAL_STYLES as readonly string[]).includes(value);

const normalizeVisualStyle = (value: unknown): BloodlineCardVisualStyle =>
  isVisualStyle(value) ? value : "noir";

const makeCardItem = (card: {
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
}, visualStyle: BloodlineCardVisualStyle = "noir") => ({
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
  transfers: [],
  visualStyle,
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardIssueLineResponse>
) {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, card: null, error: "로그인이 필요합니다." });
  }

  const parsedCardId = Number(req.query.id);
  const {
    toUserName,
    receiverNickName,
    receiverName,
    name = "",
    description = "",
    image = "",
  } = req.body || {};
  const parsedToUserName = String(toUserName || receiverNickName || receiverName || "").trim();
  const parsedName = String(name || "").trim().slice(0, 40);
  const parsedDescription = String(description || "").trim().slice(0, 300);
  const parsedImage = String(image || "").trim().slice(0, 200);

  if (!parsedCardId || Number.isNaN(parsedCardId)) {
    return res.status(400).json({
      success: false,
      card: null,
      error: "유효한 혈통카드 ID가 필요합니다.",
    });
  }
  const defaultLineName = parsedName || `${String(req.session.user?.name || "브리더")} 라인`;

  try {
    await ensureBloodlineSchema();
    const runIssueLine = async () => {
      const receiverWhere = parsedToUserName
        ? ({ name: parsedToUserName } as const)
        : ({ id: userId } as const);

      return client.$transaction(
        async (tx) => {
          const sourceCard = await tx.bloodlineCard.findUnique({
            where: { id: parsedCardId, status: "ACTIVE" },
            select: {
              id: true,
              cardType: true,
              name: true,
              description: true,
              image: true,
              speciesType: true,
              bloodlineReferenceId: true,
              currentOwnerId: true,
              status: true,
            },
          });
          const targetUser = await tx.user.findUnique({
            where: receiverWhere,
            select: { id: true, status: true },
          });

          if (!sourceCard) return "not-found" as const;
          if (!targetUser) return "target-not-found" as const;
          if (targetUser.status !== "ACTIVE") return "target-inactive" as const;

          const source = sourceCard as SourceCard;
          const canIssue = source.cardType === "BLOODLINE" && source.currentOwnerId === userId;
          if (!canIssue) {
            return "forbidden" as const;
          }

          const bloodlineReferenceId =
            source.cardType === "BLOODLINE" ? source.id : source.bloodlineReferenceId;
          if (!bloodlineReferenceId) return "invalid-source" as const;

          const existing = await tx.bloodlineCard.findFirst({
            where: {
              cardType: "LINE",
              parentCardId: source.id,
              bloodlineReferenceId,
              currentOwnerId: targetUser.id,
              status: "ACTIVE",
            },
            select: { id: true },
          });
          if (existing) return "duplicate" as const;

          const sourceStyleRows = await tx.$queryRaw<{ visualStyle: string | null }[]>`
            SELECT "visualStyle"
            FROM "BloodlineCard"
            WHERE id = ${parsedCardId}
          `;
          const sourceVisualStyle = normalizeVisualStyle(sourceStyleRows[0]?.visualStyle);

          await tx.bloodlineCard.update({
            where: { id: source.id },
            data: { issueCount: { increment: 1 } },
          });

          const created = await tx.bloodlineCard.create({
            data: {
              cardType: "LINE",
              speciesType: source.speciesType,
              bloodlineReferenceId,
              parentCardId: source.id,
              creatorId: userId,
              currentOwnerId: targetUser.id,
              name: defaultLineName,
              description: parsedDescription || `${source.name} 라인카드`,
              image: parsedImage || null,
              transferPolicy: "LIMITED_CHAIN",
            },
            include: {
              creator: { select: { id: true, name: true } },
              currentOwner: { select: { id: true, name: true } },
            },
          });

          await tx.$executeRaw`
            UPDATE "BloodlineCard"
            SET "visualStyle" = ${sourceVisualStyle}
            WHERE id = ${created.id}
          `;

          await tx.bloodlineCardEvent.create({
            data: {
              cardId: source.id,
              action: "LINE_ISSUED",
              actorUserId: userId,
              toUserId: targetUser.id,
              relatedCardId: created.id,
              note: `라인카드 발급: ${created.name}`,
            },
          });

          await tx.bloodlineCardEvent.create({
            data: {
              cardId: created.id,
              action: "LINE_CREATED",
              actorUserId: userId,
              toUserId: targetUser.id,
              note: "라인카드 생성",
            },
          });

          return makeCardItem(created, sourceVisualStyle);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        }
      );
    };

    const issueLine = async () => {
      try {
        return await runIssueLine();
      } catch (error) {
        if ((error as { code?: string })?.code === "P2034") {
          return "conflict" as const;
        }
        throw error;
      }
    };

    let issuedLine:
      | BloodlineCardItem
      | "not-found"
      | "target-not-found"
      | "target-inactive"
      | "forbidden"
      | "invalid-source"
      | "duplicate"
      | "conflict"
      | null = null;

    issuedLine = await issueLine();

    if (issuedLine === "not-found") {
      return res.status(404).json({ success: false, card: null, error: "혈통카드를 찾을 수 없습니다." });
    }
    if (issuedLine === "target-not-found") {
      return res.status(404).json({ success: false, card: null, error: "받는 사람 닉네임을 찾을 수 없습니다." });
    }
    if (issuedLine === "target-inactive") {
      return res.status(400).json({ success: false, card: null, error: "해당 유저는 현재 카드를 받을 수 없습니다." });
    }
    if (issuedLine === "forbidden") {
      return res.status(403).json({
        success: false,
        card: null,
        error: "현재 보유자 권한으로만 라인 발급이 가능합니다.",
      });
    }
    if (issuedLine === "invalid-source") {
      return res.status(400).json({ success: false, card: null, error: "원본 혈통 정보가 없어 라인을 발급할 수 없습니다." });
    }
    if (issuedLine === "duplicate") {
      return res.status(409).json({ success: false, card: null, error: "이미 해당 유저에게 라인카드를 발급했습니다." });
    }
    if (issuedLine === "conflict") {
      return res.status(409).json({
        success: false,
        card: null,
        error: "동일 대상에 대한 동시 발급 요청이 감지되었습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    if (!issuedLine) {
      return res.status(500).json({ success: false, card: null, error: "라인카드 발급에 실패했습니다." });
    }

    return res.json({ success: true, card: issuedLine });
  } catch (error) {
    const resolved = resolveBloodlineApiError(error, "라인카드 발급에 실패했습니다.");
    console.error("[bloodline-cards][POST issue-line]", error);
    return res.status(resolved.status).json({
      success: false,
      card: null,
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
