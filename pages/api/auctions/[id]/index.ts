import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { Auction, Bid, User } from "@prisma/client";
import { extractAuctionIdFromPath } from "@libs/auction-route";
import {
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MIN_START_PRICE,
  canEditAuction,
  getAuctionEditDeadline,
  isAuctionDurationValid,
  getBidIncrement,
  isBidIncrementValid,
  readRequestedBidIncrement,
  AUCTION_BID_INCREMENT_RANGE_TEXT,
  AUCTION_PHOTOS_MAX,
  AUCTION_PHOTOS_MIN,
} from "@libs/auctionRules";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { normalizeOptionalText, normalizeOptionalUrl } from "@libs/shared/normalize";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import {
  canAttachBloodline,
  getBloodlineLinkSummary,
  pedigreeNoteDbValue,
  readStoredPedigreeNote,
} from "@libs/server/bloodline-link";
import { captureServerEvent } from "@libs/server/analytics";
import {
  parsePedigreeNote,
  PEDIGREE_NOTE_INVALID_MESSAGE,
  PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
  type PedigreeNote,
} from "@libs/shared/pedigree-note";
import type { AuctionBloodlineLinkSummary } from "@libs/shared/bloodline-card";

/** Prisma Int(INT4) 최대값. 이보다 큰 혈통 id 는 잘못된 값(null)으로 본다. */
const INT4_MAX = 2_147_483_647;

/** 경매 상세 응답 타입 */
export interface AuctionDetailResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  auction?: Omit<Auction, "pedigreeNote"> & {
    user: Pick<User, "id" | "name" | "avatar"> & {
      breederPrograms: BreederProgramSummary[];
    };
    bids: (Bid & { user: Pick<User, "id" | "name" | "avatar"> })[];
    _count: { bids: number };
    /** 부·모 크기·누대(규칙에 맞는 키만). 혈통을 붙이지 않았으면 null. */
    pedigreeNote?: PedigreeNote | null;
    /**
     * 연결한 혈통 요약. 연결이 없거나 혈통이 ACTIVE 가 아니면 null.
     * winnerReceived 는 판매자 + 종료 + 낙찰자 있음일 때만 싣는다(낙찰자가 이미 출처 카드·혈통을 가졌는지).
     */
    bloodline?: AuctionBloodlineLinkSummary | null;
  };
  isOwner?: boolean;
  canEdit?: boolean;
  editAvailableUntil?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id },
    user,
  } = req;

  const auctionId = extractAuctionIdFromPath(id);
  if (isNaN(auctionId)) {
    return res.status(400).json({
      success: false,
      error: "유효하지 않은 경매 ID입니다.",
      errorCode: "AUCTION_INVALID_ID",
    });
  }

  if (req.method === "GET") {
    // 종료 시간이 지났으면 공통 정산 로직으로 처리
    await settleExpiredAuctions(auctionId);

    const auction = await client.auction.findUnique({
      where: { id: auctionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            breederPrograms: {
              where: { status: "ACTIVE" as const },
              select: breederProgramSummarySelect,
            },
          },
        },
        bids: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { amount: "desc" },
          take: 20,
        },
        _count: { select: { bids: true } },
      },
    });

    if (!auction) {
      return res.status(404).json({
        success: false,
        error: "경매를 찾을 수 없습니다.",
        errorCode: "AUCTION_NOT_FOUND",
      });
    }

    const isOwner = user?.id === auction.userId;
    // 운영자가 숨긴 경매는 작성자와 관리자만 본다.
    if (auction.isHidden && !isOwner && !isModeratorUser(user)) {
      return res.status(404).json({
        success: false,
        error: "운영 정책에 따라 비공개된 경매입니다.",
        errorCode: "AUCTION_HIDDEN",
      });
    }
    const canEdit = canEditAuction({
      isOwner: Boolean(isOwner),
      createdAt: auction.createdAt,
      status: auction.status,
      bidCount: auction._count.bids,
    });

    // 연결한 혈통 요약(판매자 관계 포함, 뷰어와 무관). 판매자에게는 종료 경매의 낙찰자 보내기 제안용으로
    // 낙찰자가 이미 그 혈통의 출처 카드(또는 혈통 자체)를 가졌는지도 알려 준다.
    // 판매자가 지금 보낼 수 없으면(혈통을 넘겼고 출처 카드도 없음) winnerReceived 를 싣지 않는다 → 제안 행이 없다.
    // 곁가지 정보라 조회가 실패해도 경매 상세는 그대로 준다(행만 빠진다).
    let bloodline: AuctionBloodlineLinkSummary | null = null;
    if (auction.bloodlineRootId) {
      try {
        const summary = await getBloodlineLinkSummary(auction.bloodlineRootId, auction.userId);
        bloodline = summary;
        if (summary && isOwner && auction.status === "종료" && auction.winnerId) {
          // 보낼 수 있다 = 뿌리 보유(출처 카드 보내기) 또는 그 뿌리의 출처 카드 보유(다음 분에게 보내기)
          const sellerCanSend = await canAttachBloodline(summary.id, auction.userId);
          if (sellerCanSend.ok) {
            const winnerHolds = await canAttachBloodline(summary.id, auction.winnerId);
            bloodline = { ...summary, winnerReceived: winnerHolds.ok };
          }
        }
      } catch (error) {
        console.error("[api/auctions/:id][bloodline-summary]", error);
        bloodline = null;
      }
    }

    const serializedAuction = {
      ...auction,
      user: {
        ...auction.user,
        breederPrograms: getSortedActiveBreederProgramSummaries(
          auction.user.breederPrograms
        ),
      },
      pedigreeNote: readStoredPedigreeNote(auction.pedigreeNote),
      bloodline,
    };

    return res.json({
      success: true,
      auction: serializedAuction,
      isOwner,
      canEdit,
      editAvailableUntil: getAuctionEditDeadline(auction.createdAt).toISOString(),
    });
  }

  if (req.method === "POST") {
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        errorCode: "AUCTION_AUTH_REQUIRED",
      });
    }

    const {
      action,
      title,
      description,
      photos,
      category,
      startPrice,
      endAt,
      sellerPhone,
      sellerEmail,
      sellerBlogUrl,
      sellerCafeNick,
      sellerBandNick,
      sellerProofImage,
      sellerTrustNote,
      bloodlineRootId,
      minBidIncrement: requestedBidIncrement,
      pedigreeNote: requestedPedigreeNote,
    } = req.body;

    if (action !== "update") {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 요청입니다.",
        errorCode: "AUCTION_INVALID_ACTION",
      });
    }
    try {
      const owner = await client.user.findUnique({
        where: { id: user.id },
        select: { status: true, phone: true, email: true },
      });
      if (!owner || owner.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          error: "현재 계정 상태에서는 경매 수정이 제한됩니다.",
          errorCode: "AUCTION_OWNER_RESTRICTED",
        });
      }

      const auction = await client.auction.findUnique({
        where: { id: auctionId },
        include: { _count: { select: { bids: true } } },
      });

      if (!auction) {
        return res.status(404).json({
          success: false,
          error: "경매를 찾을 수 없습니다.",
          errorCode: "AUCTION_NOT_FOUND",
        });
      }

      const editable = canEditAuction({
        isOwner: auction.userId === user.id,
        createdAt: auction.createdAt,
        status: auction.status,
        bidCount: auction._count.bids,
      });

      if (!editable) {
        return res.status(400).json({
          success: false,
          error: "진행중 상태에서 등록 후 10분 이내, 입찰이 없는 경우에만 수정할 수 있습니다.",
          errorCode: "AUCTION_EDIT_NOT_ALLOWED",
        });
      }

      if (!title || !description || !startPrice) {
        return res.status(400).json({
          success: false,
          error: "필수 항목을 모두 입력해주세요.",
          errorCode: "AUCTION_REQUIRED_FIELDS",
        });
      }

      const normalizedStartPrice = Number(startPrice);
      if (Number.isNaN(normalizedStartPrice) || normalizedStartPrice < AUCTION_MIN_START_PRICE) {
        return res.status(400).json({
          success: false,
          error: `시작가는 최소 ${AUCTION_MIN_START_PRICE.toLocaleString()}원 이상이어야 합니다.`,
          errorCode: "AUCTION_INVALID_START_PRICE",
        });
      }

      const sentBidIncrement = readRequestedBidIncrement(requestedBidIncrement);
      if (sentBidIncrement !== undefined && !isBidIncrementValid(sentBidIncrement)) {
        return res.status(400).json({
          success: false,
          error: `최소 입찰 단위는 ${AUCTION_BID_INCREMENT_RANGE_TEXT}로 정해주세요.`,
          errorCode: "AUCTION_INVALID_BID_INCREMENT",
        });
      }
      // 입찰 단위를 보내지 않는 구 앱의 수정: 단위를 따로 정한 적 없으면(저장값 = 기존 시작가 구간값) 예전처럼
      // 새 시작가 구간값으로 다시 계산하고, 웹·새 앱에서 따로 정한 값은 덮어쓰지 않는다.
      const nextBidIncrement =
        sentBidIncrement ??
        (auction.minBidIncrement === getBidIncrement(auction.startPrice)
          ? getBidIncrement(normalizedStartPrice)
          : undefined);

      // endAt 을 생략하거나 기존 값과 같은 시각(밀리초 timestamp 비교)을 보내면
      // 종료 시각을 바꾸지 않는 수정으로 보고 기간 검사를 건너뛴다(#140).
      const isEndAtOmitted = endAt === undefined || endAt === null || endAt === "";
      const endDate = isEndAtOmitted ? new Date(auction.endAt) : new Date(endAt);
      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "유효한 종료 시간을 선택해주세요.",
          errorCode: "AUCTION_INVALID_END_AT",
        });
      }
      const isEndAtUnchanged =
        endDate.getTime() === new Date(auction.endAt).getTime();
      if (!isEndAtUnchanged && !isAuctionDurationValid(endDate)) {
        return res.status(400).json({
          success: false,
          error: "경매 기간은 수정 시점 기준 1시간~72시간 사이여야 합니다.",
          errorCode: "AUCTION_DURATION_OUT_OF_RANGE_UPDATE",
        });
      }

      const normalizedPhotos = Array.isArray(photos) ? photos : [];
      const parsedBloodlineRootId = Number(bloodlineRootId);
      const normalizedBloodlineRootId =
        Number.isInteger(parsedBloodlineRootId) &&
        parsedBloodlineRootId > 0 &&
        parsedBloodlineRootId <= INT4_MAX
          ? parsedBloodlineRootId
          : null;
      if (
        normalizedPhotos.length < AUCTION_PHOTOS_MIN ||
        normalizedPhotos.length > AUCTION_PHOTOS_MAX
      ) {
        return res.status(400).json({
          success: false,
          error: `사진은 최소 ${AUCTION_PHOTOS_MIN}장, 최대 ${AUCTION_PHOTOS_MAX}장까지 등록할 수 있습니다.`,
          errorCode: "AUCTION_INVALID_PHOTO_COUNT",
        });
      }

      // 부·모 크기·누대는 보낸 때만 바꾼다(구 앱은 보내지 않아 기존 값 유지, #174 입찰 단위와 같은 방식).
      // 혈통 id 는 예전처럼 전체 교체라 안 보내면 해제되고, 해제되면 부모 정보도 지운다.
      const pedigreeSent = requestedPedigreeNote !== undefined;
      const pedigree = parsePedigreeNote(requestedPedigreeNote);
      if (!pedigree.ok) {
        return res.status(400).json({
          success: false,
          error: PEDIGREE_NOTE_INVALID_MESSAGE,
          errorCode: "AUCTION_INVALID_PEDIGREE_NOTE",
        });
      }
      if (pedigree.value && bloodlineRootId === undefined) {
        return res.status(400).json({
          success: false,
          error: PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
          errorCode: "AUCTION_PEDIGREE_WITHOUT_BLOODLINE",
        });
      }
      const nextPedigree: { pedigreeNote: PedigreeNote | null } | null = !normalizedBloodlineRootId
        ? { pedigreeNote: null }
        : pedigreeSent
          ? { pedigreeNote: pedigree.value }
          : null;

      // 새 혈통을 붙이거나 바꿀 때만 권한을 본다(지금 보유 또는 출처 카드 보유). 이미 연결된 혈통을
      // 그대로 보내는 수정은 그 뒤 혈통을 넘겼거나 회수됐어도 막지 않는다. 오류 코드는 그대로다.
      const storedBloodlineRootId = auction.bloodlineRootId ?? null;
      let attachRelation: "mine" | "received" | null = null;
      if (normalizedBloodlineRootId && normalizedBloodlineRootId !== storedBloodlineRootId) {
        const decision = await canAttachBloodline(normalizedBloodlineRootId, user.id);
        if (!decision.ok) {
          const notFound = decision.reason === "not_found";
          return res.status(notFound ? 400 : 403).json({
            success: false,
            error: notFound
              ? "연결할 혈통을 찾을 수 없어요"
              : "내가 보유했거나 출처 카드를 받은 혈통만 연결할 수 있어요",
            errorCode: notFound ? "AUCTION_INVALID_BLOODLINE_ROOT" : "AUCTION_BLOODLINE_FORBIDDEN",
          });
        }
        attachRelation = decision.relation;
      }

      if (
        normalizedStartPrice >= AUCTION_HIGH_PRICE_REQUIRE_CONTACT &&
        !owner.phone &&
        !owner.email &&
        !normalizeOptionalText(sellerPhone, 40) &&
        !normalizeOptionalText(sellerEmail, 120)
      ) {
        return res.status(400).json({
          success: false,
          error: `시작가 ${AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상 경매는 연락처(전화/이메일) 정보가 필요합니다.`,
          errorCode: "AUCTION_CONTACT_REQUIRED_HIGH_PRICE",
        });
      }

      const updatedAuction = await client.auction.update({
        where: { id: auctionId },
        data: {
          title,
          description,
          photos: normalizedPhotos,
          category: category || null,
          sellerPhone: normalizeOptionalText(sellerPhone, 40),
          sellerEmail: normalizeOptionalText(sellerEmail, 120),
          sellerBlogUrl: normalizeOptionalUrl(sellerBlogUrl),
          sellerCafeNick: normalizeOptionalText(sellerCafeNick, 60),
          sellerBandNick: normalizeOptionalText(sellerBandNick, 60),
          sellerProofImage: normalizeOptionalText(sellerProofImage, 120),
          sellerTrustNote: normalizeOptionalText(sellerTrustNote, 300),
          bloodlineRootId: normalizedBloodlineRootId,
          ...(nextPedigree ? { pedigreeNote: pedigreeNoteDbValue(nextPedigree.pedigreeNote) } : {}),
          startPrice: normalizedStartPrice,
          currentPrice: normalizedStartPrice,
          ...(nextBidIncrement !== undefined ? { minBidIncrement: nextBidIncrement } : {}),
          endAt: endDate,
        },
      });

      // 혈통이 없던 경매에 새로 붙였을 때만 계측한다(응답 직전, 1.5초 상한, 실패해도 무시).
      if (normalizedBloodlineRootId && !storedBloodlineRootId && attachRelation) {
        const attachedNote = nextPedigree
          ? nextPedigree.pedigreeNote
          : readStoredPedigreeNote(auction.pedigreeNote);
        await captureServerEvent(user.id, "auction_bloodline_attached", {
          auction_id: auction.id,
          bloodline_id: normalizedBloodlineRootId,
          relation: attachRelation,
          has_pedigree: Boolean(attachedNote),
          generation: attachedNote?.generation ?? null,
        });
      }

      return res.json({ success: true, auction: updatedAuction });
    } catch (error) {
      console.error("Auction update error:", error);
      return res.status(500).json({
        success: false,
        error: "경매 수정 중 오류가 발생했습니다.",
        errorCode: "AUCTION_UPDATE_FAILED",
      });
    }
  }
}

export default withAuth(
  withHandler({ methods: ["GET", "POST"], handler, isPrivate: false })
);
