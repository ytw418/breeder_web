import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import { countReceivedOwners } from "@libs/server/bloodline-mapper";
import { loadBloodlineVisibility, rootIdOf } from "@libs/server/bloodline-visibility";
import { DELETED_USER_LABEL } from "@libs/shared/deletedUser";
import type {
  BloodlineRecipientItem,
  BloodlineRecipientsResponse,
} from "@libs/shared/bloodline-card";

/**
 * 받은 사람 목록(공개, 뷰어별 닉네임 비공개) — 설계 §3.4, 앱 S-4a.
 * - 뿌리 기준이다(출처 카드 id 로 열어도 그 뿌리의 받은 사람).
 * - 받은 사람 = 그 뿌리의 ACTIVE 출처 카드 현재 보유자 중 뿌리를 만든 사람·발급자 본인(레거시 본인 발급)을 뺀 사람.
 *   같은 사람이 여러 장이면 처음 받은 카드 하나로 센다. total 은 상세의 receivedCount 와 같다(countReceivedOwners).
 * - via: 발급받은 그대로면 direct, 다음 분에게 보내기(LINE_TRANSFER)로 넘겨받았으면 rehomed.
 *   receivedAt 은 direct 면 발급일, rehomed 면 마지막으로 넘겨받은 날. 최신순.
 * - nameVisible: 그 사람이 누구에게나 보이는지(뿌리 만든 사람·보유자이거나 출처 카드 닉네임 공개를 켬).
 */

const EMPTY = { total: 0, recipients: [] };

const parseCardId = (value: unknown): number | null => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const cardSelect = {
  id: true,
  cardType: true,
  bloodlineReferenceId: true,
  status: true,
  creatorId: true,
} as const;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineRecipientsResponse>
) {
  const cardId = parseCardId(req.query.id);
  if (!cardId) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: EMPTY });
  const viewerId = req.user?.id ?? null;

  try {
    const card = await client.bloodlineCard.findUnique({ where: { id: cardId }, select: cardSelect });
    if (!card) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: EMPTY });
    if (card.status !== "ACTIVE") return sendBloodlineError(res, "BLOODLINE_REVOKED", { body: EMPTY });

    const rootId = rootIdOf(card);
    const root =
      rootId === card.id
        ? card
        : await client.bloodlineCard.findUnique({ where: { id: rootId }, select: cardSelect });
    if (!root) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: EMPTY });
    if (root.status !== "ACTIVE") return sendBloodlineError(res, "BLOODLINE_REVOKED", { body: EMPTY });

    const [visibility, lines] = await Promise.all([
      loadBloodlineVisibility(root.id, viewerId),
      client.bloodlineCard.findMany({
        where: { cardType: "LINE", status: "ACTIVE", bloodlineReferenceId: root.id },
        select: {
          id: true,
          creatorId: true,
          currentOwnerId: true,
          transferCount: true,
          createdAt: true,
          currentOwner: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    // countReceivedOwners 와 같은 기준: 뿌리를 만든 사람·발급자 본인이 가진 카드는 받은 사람이 아니다
    const receivedLines = lines.filter(
      (line) => line.currentOwnerId !== root.creatorId && line.currentOwnerId !== line.creatorId
    );

    const rehomedIds = receivedLines.filter((line) => line.transferCount > 0).map((line) => line.id);
    const handoffs = rehomedIds.length
      ? await client.bloodlineCardTransfer.findMany({
          where: { cardId: { in: rehomedIds } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { cardId: true, toUserId: true, createdAt: true },
        })
      : [];

    const firstByOwner = new Map<number, { line: (typeof receivedLines)[number]; via: "direct" | "rehomed"; at: Date }>();
    for (const line of receivedLines) {
      const via = line.transferCount > 0 ? "rehomed" : "direct";
      const handoff =
        via === "rehomed"
          ? handoffs.find((t) => t.cardId === line.id && t.toUserId === line.currentOwnerId)
          : undefined;
      const at = handoff?.createdAt ?? line.createdAt;
      const existing = firstByOwner.get(line.currentOwnerId);
      if (!existing || at.getTime() < existing.at.getTime()) {
        firstByOwner.set(line.currentOwnerId, { line, via, at });
      }
    }

    const recipients: BloodlineRecipientItem[] = Array.from(firstByOwner.values())
      .sort((a, b) => b.at.getTime() - a.at.getTime() || b.line.id - a.line.id)
      .map(({ line, via, at }) => {
        const item: BloodlineRecipientItem = {
          user: visibility.present(line.currentOwner) ?? { id: 0, name: DELETED_USER_LABEL },
          lineCardId: line.id,
          via,
          receivedAt: at.toISOString(),
        };
        item.nameVisible = !item.user.masked && visibility.isPublic(line.currentOwnerId);
        if (viewerId && line.currentOwnerId === viewerId) item.isMe = true;
        return item;
      });

    return res.json({
      success: true,
      total: countReceivedOwners(lines, root.creatorId),
      recipients,
    });
  } catch (error) {
    console.error("[bloodline-cards][GET recipients]", error);
    return sendResolvedBloodlineError(res, error, "받은 사람을 불러오지 못했어요", EMPTY);
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
