import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { addCardOwner } from "@libs/server/bloodline-ownership";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import {
  bloodlineCardInclude,
  fetchReceivedCounts,
  toBloodlineCardItem,
  type BloodlineCardWithRelations,
} from "@libs/server/bloodline-mapper";
import { resolveBloodlineSpecies } from "@libs/server/bloodline-species";
import { loadBloodlineVisibilities, rootIdOf } from "@libs/server/bloodline-visibility";
import { captureServerEvent } from "@libs/server/analytics";
import { bloodlineNameKey, validateBloodlineName } from "@libs/shared/bloodline-names";
import { formatRegionShort, parseOptionalRegion } from "@libs/shared/regions";
import { DELETED_USER_LABEL } from "@libs/shared/deletedUser";
import { resolveCategoryIdByName } from "@libs/server/categories";
import type { BloodlineErrorCode } from "@libs/shared/bloodline-errors";
import type {
  AttachableBloodline,
  BloodlineCardItem,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";

/**
 * 내 혈통 목록(GET)과 혈통 만들기(POST) — 설계 §3.1.
 * - 권한·분류는 `currentOwnerId` 하나로 본다. "내 혈통" = 지금 내가 보유한 혈통(만든 사람과 무관).
 *   카드 안의 사람(만든 사람·보유자·transfers)은 상세와 같은 닉네임 비공개 규칙으로 가린다(내가 직접 주고받지 않은
 *   이전 보유자는 "닉네임 비공개"). 메모는 mapper 가 뷰어 기준으로 거른다.
 * - 만들기: 이름(띄어쓰기 허용, 정규화 키 중복 검사는 트랜잭션 안) → 종(노출 카테고리 이름) → 사진 → 산지(선택) → 소개(선택).
 *   visualStyle·transferPolicy 는 구 클라이언트 호환으로 받기만 하고 저장하지 않는다.
 * - 모든 오류 응답은 `errorCode` 와 빈 목록 키를 싣는다(구 클라이언트는 `error` 문구를 그대로 보여 준다).
 */

const DESCRIPTION_MAX_LENGTH = 300;
const IMAGE_MAX_LENGTH = 200;
const CREATED_NOTE = "혈통을 만들었어요";

const userSelect = { select: { id: true, name: true } } as const;

type ListBody = Omit<BloodlineCardsResponse, "success" | "error" | "errorCode" | "attachable">;

const emptyLists = (): ListBody => ({
  myBloodlines: [],
  receivedBloodlines: [],
  createdLines: [],
  receivedLines: [],
  myCreatedCards: [],
  receivedCards: [],
  ownedCards: [],
});

type UserLike = { id: number; name: string } | null | undefined;

const userRefOf = (user: UserLike, fallbackId = 0) =>
  user ? { id: user.id, name: user.name } : { id: fallbackId, name: DELETED_USER_LABEL };

/** 최근 것이 앞(updatedAt → id). */
const byRecentlyUpdated = (a: BloodlineCardWithRelations, b: BloodlineCardWithRelations) =>
  b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id;

/** 문자열이면 앞뒤 공백을 지우고 max 자로 자른다. 비거나 문자열이 아니면 null. */
const readOptionalText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
};

/* ------------------------------------------------------------------ */
/* GET                                                                */
/* ------------------------------------------------------------------ */

/**
 * 출처 카드를 내가 어떻게 받았는지: 다음 분에게 보내기로 받았으면 마지막 넘김(보낸 사람·날짜),
 * 아니면 발급(발급자·발급일). transfers 는 최신순 5건이다.
 */
const receiptOf = (line: BloodlineCardWithRelations, userId: number) => {
  const handoff = line.transfers.find((transfer) => transfer.toUserId === userId && transfer.fromUser);
  if (handoff) return { from: userRefOf(handoff.fromUser), at: handoff.createdAt };
  return { from: userRefOf(line.creator, line.creatorId), at: line.createdAt };
};

/**
 * 상품·경매에 붙일 수 있는 혈통(`?mode=attach`). 권한 기준은 libs/server/bloodline-link canAttachBloodline 과 같다:
 * 지금 보유한 혈통(mine) + ACTIVE 뿌리의 출처 카드를 가진 혈통(received, 뿌리마다 가장 먼저 받은 카드 하나).
 */
async function buildAttachable(
  userId: number,
  myBloodlines: BloodlineCardWithRelations[],
  heldLines: BloodlineCardWithRelations[]
): Promise<AttachableBloodline[]> {
  const mine: AttachableBloodline[] = myBloodlines.map((card) => ({
    rootId: card.id,
    name: card.name,
    speciesType: card.speciesType,
    originLabel: formatRegionShort({ sido: card.originSido, sigungu: card.originSigungu }),
    creator: userRefOf(card.creator, card.creatorId),
    relation: "mine",
    image: card.image ?? null,
  }));

  const mineIds = new Set(myBloodlines.map((card) => card.id));
  const lineByRoot = new Map<number, BloodlineCardWithRelations>();
  const oldestFirst = [...heldLines].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id
  );
  for (const line of oldestFirst) {
    const rootId = line.bloodlineReferenceId;
    if (!rootId || mineIds.has(rootId) || lineByRoot.has(rootId)) continue;
    lineByRoot.set(rootId, line);
  }
  if (!lineByRoot.size) return mine;

  const roots = await client.bloodlineCard.findMany({
    where: { id: { in: Array.from(lineByRoot.keys()) }, cardType: "BLOODLINE", status: "ACTIVE" },
    include: { creator: userSelect },
  });

  const received = roots
    .map((root) => {
      const line = lineByRoot.get(root.id) as BloodlineCardWithRelations;
      const receipt = receiptOf(line, userId);
      const item: AttachableBloodline = {
        rootId: root.id,
        name: root.name,
        speciesType: root.speciesType,
        originLabel: formatRegionShort({ sido: root.originSido, sigungu: root.originSigungu }),
        creator: userRefOf(root.creator, root.creatorId),
        relation: "received",
        image: root.image ?? line.image ?? null,
        lineCardId: line.id,
        receivedFrom: receipt.from,
        receivedAt: receipt.at.toISOString(),
      };
      return item;
    })
    .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));

  return [...mine, ...received];
}

async function handleList(req: NextApiRequest, res: NextApiResponse, userId: number) {
  const mode = typeof req.query.mode === "string" ? req.query.mode.toLowerCase() : "";
  try {
    const owned = await client.bloodlineCard.findMany({
      where: {
        currentOwnerId: userId,
        status: "ACTIVE",
        ...(mode === "create" ? { cardType: "BLOODLINE" as const } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: bloodlineCardInclude,
    });

    const bloodlines = owned.filter((card) => card.cardType === "BLOODLINE");
    const lines = owned.filter((card) => card.cardType === "LINE");
    const [receivedCounts, { visibilities }] = await Promise.all([
      fetchReceivedCounts(bloodlines.map((card) => ({ id: card.id, creatorId: card.creatorId }))),
      loadBloodlineVisibilities(owned.map(rootIdOf), userId),
    ]);

    const items = new Map<number, BloodlineCardItem>();
    const toItem = (card: BloodlineCardWithRelations) => {
      const cached = items.get(card.id);
      if (cached) return cached;
      const item = toBloodlineCardItem(card, {
        viewerId: userId,
        isOwnedByMe: true,
        visibility: visibilities.get(rootIdOf(card)) ?? null,
        ...(card.cardType === "BLOODLINE" ? { receivedCount: receivedCounts.get(card.id) ?? 0 } : {}),
      });
      items.set(card.id, item);
      return item;
    };

    const myBloodlines = bloodlines.map(toItem);
    // 남이 만든 혈통을 넘겨받은 것(혈통 넘기기). 호환용
    const receivedBloodlines = bloodlines
      .filter((card) => card.creatorId !== userId)
      .sort(byRecentlyUpdated)
      .map(toItem);
    // 레거시 본인 발급 출처 카드. 새 화면은 그리지 않는다
    const createdLines = lines.filter((card) => card.creatorId === userId).map(toItem);
    // "받은 출처 카드"
    const receivedLines = lines
      .filter((card) => card.creatorId !== userId)
      .sort(byRecentlyUpdated)
      .map(toItem);
    const ownedCards = [...owned].sort(byRecentlyUpdated).map(toItem);

    const body: BloodlineCardsResponse = {
      success: true,
      myBloodlines,
      receivedBloodlines,
      createdLines,
      receivedLines,
      myCreatedCards: [...myBloodlines],
      receivedCards: [...receivedBloodlines, ...receivedLines],
      ownedCards,
    };
    if (mode === "attach") {
      body.attachable = await buildAttachable(userId, bloodlines, lines);
    }
    return res.json(body);
  } catch (error) {
    console.error("[bloodline-cards][GET]", error);
    return sendResolvedBloodlineError(res, error, "혈통 목록을 불러오지 못했어요", emptyLists());
  }
}

/* ------------------------------------------------------------------ */
/* POST                                                               */
/* ------------------------------------------------------------------ */

async function handleCreate(req: NextApiRequest, res: NextApiResponse, userId: number) {
  const body: Record<string, unknown> =
    req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const reject = (errorCode: BloodlineErrorCode) =>
    sendBloodlineError(res, errorCode, { body: emptyLists() });

  // 기본 이름(닉네임+혈통) 폴백은 없다. 이름이 없으면 400
  const name = validateBloodlineName(body.name);
  if (!name.ok) return reject("BLOODLINE_INVALID_NAME");

  try {
    const species = await resolveBloodlineSpecies(body.speciesType);
    if (!species.ok) return reject(species.errorCode);
    // 관심 카테고리 범위용 Category.id(구조만 — 아직 목록에서 쓰지 않는다).
    const categoryId = await resolveCategoryIdByName(species.speciesType);

    const image = typeof body.image === "string" ? body.image.trim().slice(0, IMAGE_MAX_LENGTH) : "";
    if (!image) return reject("BLOODLINE_IMAGE_REQUIRED");

    const origin = parseOptionalRegion(body.originSido, body.originSigungu);
    if (origin === "invalid") return reject("BLOODLINE_INVALID_ORIGIN");

    const description = readOptionalText(body.description, DESCRIPTION_MAX_LENGTH);
    const nameKey = bloodlineNameKey(name.name);

    // 중복 검사와 생성을 한 Serializable 트랜잭션에서 한다. 동시에 같은 이름을 만들면 한쪽이 P2034(409 BLOODLINE_CONFLICT).
    // 운영 숨김(INACTIVE)도 이름을 잡고 있다: 숨김 동안 같은 이름을 만들 수 있으면 숨김을 풀 때 같은 이름이 둘이 된다.
    // 이름을 풀어 주는 것은 회수(REVOKED)뿐이다.
    const created = await client.$transaction(
      async (tx) => {
        const duplicates = await tx.$queryRaw<{ id: number }[]>`
          SELECT id
          FROM "BloodlineCard"
          WHERE "cardType" = 'BLOODLINE'
            AND status IN ('ACTIVE', 'INACTIVE')
            AND lower(regexp_replace(name, '\\s', '', 'g')) = ${nameKey}
          LIMIT 1
        `;
        if (duplicates.length > 0) return null;

        const card = await tx.bloodlineCard.create({
          data: {
            creatorId: userId,
            currentOwnerId: userId,
            cardType: "BLOODLINE",
            name: name.name,
            speciesType: species.speciesType,
            categoryId,
            image,
            description,
            originSido: origin?.sido ?? null,
            originSigungu: origin?.sigungu ?? null,
          },
          include: { creator: userSelect, currentOwner: userSelect },
        });

        await tx.bloodlineCardTransfer.create({
          data: { cardId: card.id, fromUserId: null, toUserId: userId, note: CREATED_NOTE },
        });
        await addCardOwner(tx, card.id, userId);
        await tx.bloodlineCardEvent.create({
          data: {
            cardId: card.id,
            action: "BLOODLINE_CREATED",
            actorUserId: userId,
            toUserId: userId,
            note: CREATED_NOTE,
          },
        });
        return card;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!created) return reject("BLOODLINE_DUPLICATE_NAME");

    // 트랜잭션 밖, 응답 직전(서버리스라 응답 뒤 작업을 보장하지 않는다). 실패해도 reject 하지 않는다
    await captureServerEvent(userId, "bloodline_created", {
      bloodline_id: created.id,
      species_type: species.speciesType,
      has_origin: Boolean(origin),
      has_description: Boolean(description),
    });

    const item = toBloodlineCardItem(created, { viewerId: userId, isOwnedByMe: true, receivedCount: 0 });
    const response: BloodlineCardsResponse = {
      success: true,
      ...emptyLists(),
      myBloodlines: [item],
      myCreatedCards: [item],
      ownedCards: [item],
    };
    return res.json(response);
  } catch (error) {
    console.error("[bloodline-cards][POST]", error);
    return sendResolvedBloodlineError(res, error, "혈통을 만들지 못했어요", emptyLists());
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse<BloodlineCardsResponse>) {
  const userId = req.user?.id;
  if (!userId) {
    return sendBloodlineError(res, "BLOODLINE_AUTH_REQUIRED", { body: emptyLists() });
  }
  if (req.method === "POST") return handleCreate(req, res, userId);
  return handleList(req, res, userId);
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
