import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import {
  bloodlineCardInclude,
  fetchListingCounts,
  fetchReceivedCounts,
  toBloodlineCardItem,
  type BloodlineCardWithRelations,
} from "@libs/server/bloodline-mapper";
import {
  loadBloodlineVisibility,
  rootIdOf,
  type BloodlineVisibility,
} from "@libs/server/bloodline-visibility";
import { resolveBloodlineSpecies } from "@libs/server/bloodline-species";
import { parseOptionalRegion } from "@libs/shared/regions";
import type { BloodlineErrorCode } from "@libs/shared/bloodline-errors";
import type {
  BloodlineCardDetailResponse,
  BloodlineCardItem,
  BloodlineCardPatchResponse,
  BloodlineViewerRelation,
} from "@libs/shared/bloodline-card";

/**
 * 혈통 상세(GET, 공개)와 일부 고치기(PATCH, 로그인) — 설계 §3.4.
 * - GET: 뷰어별 닉네임 비공개(libs/server/bloodline-visibility). 회수·숨김(REVOKED/INACTIVE)은 404 BLOODLINE_REVOKED.
 *   출처 카드를 열었는데 그 뿌리가 회수·숨김이어도 같다. 뿌리에는 receivedCount·listingCount 를 싣는다.
 *   viewerRelation: owner(뿌리 지금 보유자) / holder(그 뿌리의 출처 카드 보유) / none. holder 면 viewerLineCard.
 * - PATCH: 보낸 필드만 바꾼다. ownerNameVisible 은 출처 카드의 지금 보유자만, 종·사진·소개·산지는 혈통의
 *   만든 사람 = 지금 보유자 = 나 일 때만. 이름은 바꾸지 않는다(이름은 전역 유일 약속). 사진은 지울 수 없다.
 *   권한 조건을 쓰기(where)에도 그대로 걸어, 읽은 뒤 넘기기·회수가 끝났으면 쓰지 않는다(403/404).
 *   뿌리의 종·사진·산지를 바꾸면 그 아래 출처 카드의 종·사진·산지도 같이 맞춘다.
 */

const DESCRIPTION_MAX_LENGTH = 300;
/** Cloudflare 이미지 id 상한(만들기 POST 와 같다). */
const IMAGE_MAX_LENGTH = 200;

const EMPTY_DETAIL = { card: null, bloodlineSourceCard: null, parentLineCard: null };

/** Prisma "조건에 맞는 행 없음"(update 의 where 불일치). */
const isRecordNotFound = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2025";

const parseCardId = (value: unknown): number | null => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const findCard = (id: number) =>
  client.bloodlineCard.findUnique({ where: { id }, include: bloodlineCardInclude });

/** 뿌리 혈통의 받은 사람 수·분양글 수(뿌리가 BLOODLINE 일 때만). */
async function loadRootCounts(root: BloodlineCardWithRelations) {
  if (root.cardType !== "BLOODLINE") return {};
  const [received, listings] = await Promise.all([
    fetchReceivedCounts([{ id: root.id, creatorId: root.creatorId }]),
    fetchListingCounts([root.id]),
  ]);
  return {
    receivedCount: received.get(root.id) ?? 0,
    listingCount: listings.get(root.id) ?? 0,
  };
}

/**
 * 뿌리 보유자가 아닌 로그인 뷰어가 가진 그 뿌리의 출처 카드.
 * 열어 본 카드가 자기 출처 카드면 그 카드, 아니면 가장 먼저 받은 것.
 */
const findViewerLine = (
  card: BloodlineCardWithRelations,
  root: BloodlineCardWithRelations,
  viewerId: number | null
): Promise<BloodlineCardWithRelations | null> => {
  if (!viewerId || root.currentOwnerId === viewerId) return Promise.resolve(null);
  if (card.cardType === "LINE" && card.currentOwnerId === viewerId) return Promise.resolve(card);
  return client.bloodlineCard.findFirst({
    where: { cardType: "LINE", bloodlineReferenceId: root.id, status: "ACTIVE", currentOwnerId: viewerId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: bloodlineCardInclude,
  });
};

const toItem = (
  card: BloodlineCardWithRelations,
  viewerId: number | null,
  visibility: BloodlineVisibility,
  counts: { receivedCount?: number; listingCount?: number } = {}
): BloodlineCardItem => toBloodlineCardItem(card, { viewerId, visibility, ...counts });

/* ------------------------------------------------------------------ */
/* GET                                                                */
/* ------------------------------------------------------------------ */

async function handleDetail(req: NextApiRequest, res: NextApiResponse, cardId: number) {
  const viewerId = req.user?.id ?? null;
  try {
    const card = await findCard(cardId);
    if (!card) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: EMPTY_DETAIL });
    if (card.status !== "ACTIVE") return sendBloodlineError(res, "BLOODLINE_REVOKED", { body: EMPTY_DETAIL });

    const rootId = rootIdOf(card);
    const root = rootId === card.id ? card : await findCard(rootId);
    if (!root) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: EMPTY_DETAIL });
    if (root.status !== "ACTIVE") return sendBloodlineError(res, "BLOODLINE_REVOKED", { body: EMPTY_DETAIL });

    const viewerIsRootOwner = Boolean(viewerId && root.currentOwnerId === viewerId);
    // 보통 출처 카드의 parentCardId 는 뿌리다. 다를 때만(호환용 parentLineCard) 따로 읽는다
    const parentId = card.parentCardId && card.parentCardId !== root.id ? card.parentCardId : null;

    const [visibility, rootCounts, viewerLine, parent] = await Promise.all([
      loadBloodlineVisibility(root.id, viewerId),
      loadRootCounts(root),
      findViewerLine(card, root, viewerId),
      parentId
        ? client.bloodlineCard.findFirst({
            where: { id: parentId, status: "ACTIVE" },
            include: bloodlineCardInclude,
          })
        : Promise.resolve(null),
    ]);

    const rootItem = toItem(root, viewerId, visibility, rootCounts);
    const cardItem = card.id === root.id ? rootItem : toItem(card, viewerId, visibility);
    const itemOf = (target: BloodlineCardWithRelations) => {
      if (target.id === root.id) return rootItem;
      if (target.id === card.id) return cardItem;
      return toItem(target, viewerId, visibility);
    };

    let parentLineCard: BloodlineCardItem | null = null;
    if (card.parentCardId === root.id) parentLineCard = rootItem;
    else if (parent) parentLineCard = itemOf(parent);

    const viewerRelation: BloodlineViewerRelation = viewerIsRootOwner
      ? "owner"
      : viewerLine
        ? "holder"
        : "none";

    const body: BloodlineCardDetailResponse = {
      success: true,
      card: cardItem,
      bloodlineSourceCard: card.id === root.id ? null : rootItem,
      parentLineCard,
      viewerLineCard: viewerLine ? itemOf(viewerLine) : null,
      viewerRelation,
    };
    return res.json(body);
  } catch (error) {
    console.error("[bloodline-cards][detail][GET]", error);
    return sendResolvedBloodlineError(res, error, "혈통을 불러오지 못했어요", EMPTY_DETAIL);
  }
}

/* ------------------------------------------------------------------ */
/* PATCH                                                              */
/* ------------------------------------------------------------------ */

async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  cardId: number,
  viewerId: number
) {
  const body: Record<string, unknown> =
    req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const reject = (errorCode: BloodlineErrorCode) =>
    sendBloodlineError(res, errorCode, { body: { card: null } });

  try {
    const card = await findCard(cardId);
    if (!card) return reject("BLOODLINE_NOT_FOUND");
    if (card.status !== "ACTIVE") return reject("BLOODLINE_REVOKED");

    // 보낸 필드만(undefined 는 안 보낸 것). 이름은 읽지 않는다
    const wantsOwnerName = typeof body.ownerNameVisible === "boolean";
    const wantsSpecies = body.speciesType !== undefined;
    const wantsImage = body.image !== undefined;
    const wantsDescription = body.description === null || typeof body.description === "string";
    const wantsOrigin = body.originSido !== undefined || body.originSigungu !== undefined;
    const wantsRootFields = wantsSpecies || wantsImage || wantsDescription || wantsOrigin;

    const isLineHolder = card.cardType === "LINE" && card.currentOwnerId === viewerId;
    const isMakerHolder =
      card.cardType === "BLOODLINE" && card.creatorId === viewerId && card.currentOwnerId === viewerId;
    if (wantsOwnerName && !isLineHolder) return reject("BLOODLINE_FORBIDDEN");
    if (wantsRootFields && !isMakerHolder) return reject("BLOODLINE_FORBIDDEN");
    if (!wantsOwnerName && !wantsRootFields && card.currentOwnerId !== viewerId) {
      return reject("BLOODLINE_FORBIDDEN");
    }

    const data: Prisma.BloodlineCardUpdateInput = {};
    if (wantsSpecies) {
      // 종은 지울 수 없다(null·빈 값은 BLOODLINE_SPECIES_REQUIRED)
      const species = await resolveBloodlineSpecies(body.speciesType);
      if (!species.ok) return reject(species.errorCode);
      data.speciesType = species.speciesType;
    }
    if (wantsImage) {
      // 사진은 바꿀 수만 있고 지울 수 없다(만들기처럼 대표 사진 1장이 필요하다)
      const image = typeof body.image === "string" ? body.image.trim().slice(0, IMAGE_MAX_LENGTH) : "";
      if (!image) return reject("BLOODLINE_IMAGE_REQUIRED");
      data.image = image;
    }
    if (wantsDescription) {
      data.description =
        typeof body.description === "string"
          ? body.description.trim().slice(0, DESCRIPTION_MAX_LENGTH) || null
          : null;
    }
    if (wantsOrigin) {
      // 산지는 짝으로 바꾼다: 시·도만 보내면 시·군·구는 지운다, 둘 다 null 이면 산지를 지운다
      const origin = parseOptionalRegion(body.originSido, body.originSigungu);
      if (origin === "invalid") return reject("BLOODLINE_INVALID_ORIGIN");
      data.originSido = origin?.sido ?? null;
      data.originSigungu = origin?.sigungu ?? null;
    }
    if (wantsOwnerName) data.ownerNameVisible = body.ownerNameVisible as boolean;

    // 쓰기 조건 = 위 권한 조건. 읽은 뒤 넘기기·회수가 먼저 끝났으면 0건이라 P2025 로 끝난다
    // (넘겨받은 새 보유자의 닉네임 공개가 이전 보유자 요청으로 켜지지 않게).
    const guard: Prisma.BloodlineCardWhereUniqueInput = {
      id: card.id,
      status: "ACTIVE",
      currentOwnerId: viewerId,
      ...(wantsOwnerName ? { cardType: "LINE" as const } : {}),
      ...(wantsRootFields ? { cardType: "BLOODLINE" as const, creatorId: viewerId } : {}),
    };

    // 출처 카드의 종·사진·산지는 보낼 때 뿌리에서 복사한 값이다. 뿌리 값을 바꾸면 출처 카드도 같이 맞춘다
    // (산지를 지운 것도 맞춘다. 산지가 없던 레거시 출처 카드는 처음 산지를 정할 때 채워진다).
    const lineSync: Prisma.BloodlineCardUpdateManyMutationInput = {};
    if (data.speciesType !== undefined) lineSync.speciesType = data.speciesType as string;
    if (data.image !== undefined) lineSync.image = data.image as string;
    if (wantsOrigin) {
      lineSync.originSido = data.originSido as string | null;
      lineSync.originSigungu = data.originSigungu as string | null;
    }

    let saved = card;
    try {
      if (Object.keys(lineSync).length > 0) {
        saved = await client.$transaction(async (tx) => {
          const updated = await tx.bloodlineCard.update({
            where: guard,
            data,
            include: bloodlineCardInclude,
          });
          await tx.bloodlineCard.updateMany({
            where: { cardType: "LINE", bloodlineReferenceId: card.id },
            data: lineSync,
          });
          return updated;
        });
      } else if (Object.keys(data).length > 0) {
        saved = await client.bloodlineCard.update({
          where: guard,
          data,
          include: bloodlineCardInclude,
        });
      }
    } catch (error) {
      if (!isRecordNotFound(error)) throw error;
      // 그 사이 상태가 바뀌었다: 회수·숨김이면 BLOODLINE_REVOKED, 아니면(넘어감) BLOODLINE_FORBIDDEN
      const latest = await client.bloodlineCard.findUnique({ where: { id: card.id }, select: { status: true } });
      if (!latest) return reject("BLOODLINE_NOT_FOUND");
      return reject(latest.status !== "ACTIVE" ? "BLOODLINE_REVOKED" : "BLOODLINE_FORBIDDEN");
    }

    const [visibility, counts] = await Promise.all([
      loadBloodlineVisibility(rootIdOf(saved), viewerId),
      loadRootCounts(saved),
    ]);
    const response: BloodlineCardPatchResponse = {
      success: true,
      card: toItem(saved, viewerId, visibility, counts),
    };
    return res.json(response);
  } catch (error) {
    console.error("[bloodline-cards][detail][PATCH]", error);
    return sendResolvedBloodlineError(res, error, "바꾸지 못했어요", { card: null });
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cardId = parseCardId(req.query.id);
  if (req.method === "PATCH") {
    const viewerId = req.user?.id;
    if (!viewerId) return sendBloodlineError(res, "BLOODLINE_AUTH_REQUIRED", { body: { card: null } });
    if (!cardId) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: { card: null } });
    return handlePatch(req, res, cardId, viewerId);
  }
  if (!cardId) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: EMPTY_DETAIL });
  return handleDetail(req, res, cardId);
}

export default withAuth(
  withHandler({
    methods: ["GET", "PATCH"],
    handler,
    isPrivate: false,
  })
);
