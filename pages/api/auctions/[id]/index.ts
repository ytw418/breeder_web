import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Auction, Bid, User } from "@prisma/client";
import { extractAuctionIdFromPath } from "@libs/auction-route";
import {
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MIN_START_PRICE,
  canEditAuction,
  getAuctionEditDeadline,
  isAuctionDurationValid,
  getBidIncrement,
} from "@libs/auctionRules";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { normalizeOptionalText, normalizeOptionalUrl } from "@libs/shared/normalize";

/** 경매 상세 응답 타입 */
export interface AuctionDetailResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  auction?: Auction & {
    user: Pick<User, "id" | "name" | "avatar">;
    bids: (Bid & { user: Pick<User, "id" | "name" | "avatar"> })[];
    _count: { bids: number };
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
    session: { user },
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
        user: { select: { id: true, name: true, avatar: true } },
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
    const canEdit = canEditAuction({
      isOwner: Boolean(isOwner),
      createdAt: auction.createdAt,
      status: auction.status,
      bidCount: auction._count.bids,
    });

    return res.json({
      success: true,
      auction,
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

      if (!title || !description || !startPrice || !endAt) {
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

      const endDate = new Date(endAt);
      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "유효한 종료 시간을 선택해주세요.",
          errorCode: "AUCTION_INVALID_END_AT",
        });
      }
      if (!isAuctionDurationValid(endDate)) {
        return res.status(400).json({
          success: false,
          error: "경매 기간은 수정 시점 기준 1시간~72시간 사이여야 합니다.",
          errorCode: "AUCTION_DURATION_OUT_OF_RANGE_UPDATE",
        });
      }

      const normalizedPhotos = Array.isArray(photos) ? photos : [];
      if (normalizedPhotos.length < 1 || normalizedPhotos.length > 5) {
        return res.status(400).json({
          success: false,
          error: "사진은 최소 1장, 최대 5장까지 등록할 수 있습니다.",
          errorCode: "AUCTION_INVALID_PHOTO_COUNT",
        });
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
          startPrice: normalizedStartPrice,
          currentPrice: normalizedStartPrice,
          minBidIncrement: getBidIncrement(normalizedStartPrice),
          endAt: endDate,
        },
      });

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

export default withApiSession(
  withHandler({ methods: ["GET", "POST"], handler, isPrivate: false })
);
