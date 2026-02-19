import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Auction, User } from "@prisma/client";
import {
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MAX_ACTIVE_PER_USER,
  AUCTION_MIN_START_PRICE,
  isAuctionDurationValid,
  getBidIncrement,
} from "@libs/auctionRules";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";
import { normalizeOptionalText, normalizeOptionalUrl } from "@libs/shared/normalize";

/** 경매 목록 응답 타입 */
export interface AuctionWithUser extends Auction {
  user: Pick<User, "id" | "name" | "avatar">;
  _count: { bids: number };
}

export interface AuctionsListResponse {
  success: boolean;
  auctions: AuctionWithUser[];
  pages: number;
}

/** 경매 등록 응답 타입 */
export interface CreateAuctionResponse {
  success: boolean;
  auction?: Auction;
  error?: string;
  errorCode?: string;
}

const AUCTION_DUPLICATE_GUARD_WINDOW_MS = 10 * 60 * 1000; // 10분
const TOOL_MODE_COOKIE = "bredy_tool_mode";
const TOOL_FIXED_CATEGORY = "기타";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  // 경매 목록 조회
  if (req.method === "GET") {
    const { page = 1, status, category, q } = req.query;

    const where: any = {};
    if (status && status !== "전체") where.status = String(status);
    if (category && category !== "전체") {
      where.category = { in: getCategoryFilterValues(String(category)) };
    }
    const keyword = typeof q === "string" ? q.trim() : "";
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { category: { contains: keyword, mode: "insensitive" } },
        { user: { name: { contains: keyword, mode: "insensitive" } } },
      ];
    }

    // 종료 시간이 지난 진행중 경매는 공통 정산 로직으로 처리
    await settleExpiredAuctions();

    // 캐싱 전략: settleExpiredAuctions 실행 후 캐시 헤더 설정
    // 검색/필터 없는 기본 목록은 30초 캐시
    // 검색어나 필터가 있는 경우 캐시 시간을 짧게 설정
    const hasFilters = q || (category && category !== "전체") || (status && status !== "전체");
    const cacheTime = hasFilters ? 15 : 30;
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
    );

    const [auctions, auctionCount] = await Promise.all([
      client.auction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { bids: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: page ? (+page - 1) * 10 : 0,
      }),
      client.auction.count({ where }),
    ]);

    return res.json({
      success: true,
      auctions,
      pages: Math.ceil(auctionCount / 10),
    });
  }

  // 경매 등록
  if (req.method === "POST") {
    const {
      session: { user },
    } = req;

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        errorCode: "AUCTION_AUTH_REQUIRED",
      });
    }

    const {
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
    const isToolMode = req.cookies?.[TOOL_MODE_COOKIE] === "1";

    const normalizedTitle = String(title || "").trim();
    const normalizedDescription = String(description || "").trim();
    const normalizedCategory = normalizeOptionalText(
      isToolMode ? TOOL_FIXED_CATEGORY : category,
      40
    );
    const normalizedSellerPhone = normalizeOptionalText(sellerPhone, 40);
    const normalizedSellerEmail = normalizeOptionalText(sellerEmail, 120);
    const normalizedSellerBlogUrl = normalizeOptionalUrl(sellerBlogUrl);
    const normalizedSellerCafeNick = normalizeOptionalText(sellerCafeNick, 60);
    const normalizedSellerBandNick = normalizeOptionalText(sellerBandNick, 60);
    const normalizedSellerProofImage = normalizeOptionalText(sellerProofImage, 120);
    const normalizedSellerTrustNote = normalizeOptionalText(sellerTrustNote, 300);
    const normalizedPhotos = Array.isArray(photos)
      ? photos
          .filter((photo): photo is string => typeof photo === "string")
          .map((photo) => photo.trim())
          .filter(Boolean)
      : [];

    // 유효성 검사
    if (!normalizedTitle || !normalizedDescription || !startPrice || !endAt) {
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
        error: "경매 기간은 등록 시점 기준 1시간~72시간 사이여야 합니다.",
        errorCode: "AUCTION_DURATION_OUT_OF_RANGE",
      });
    }

    const minBidIncrement = getBidIncrement(normalizedStartPrice);

    try {
      const seller = await client.user.findUnique({
        where: { id: user.id },
        select: { status: true, phone: true, email: true },
      });
      if (!seller || seller.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          error: "현재 계정 상태에서는 경매 등록이 제한됩니다.",
          errorCode: "AUCTION_SELLER_RESTRICTED",
        });
      }

      if (
        normalizedStartPrice >= AUCTION_HIGH_PRICE_REQUIRE_CONTACT &&
        !seller.phone &&
        !seller.email &&
        !normalizedSellerPhone &&
        !normalizedSellerEmail
      ) {
        return res.status(400).json({
          success: false,
          error: `시작가 ${AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상 경매는 연락처(전화/이메일) 정보가 필요합니다.`,
          errorCode: "AUCTION_CONTACT_REQUIRED_HIGH_PRICE",
        });
      }

      const activeAuctionCount = await client.auction.count({
        where: { userId: user.id, status: "진행중" },
      });
      if (activeAuctionCount >= AUCTION_MAX_ACTIVE_PER_USER) {
        return res.status(400).json({
          success: false,
          error: `동시 진행 경매는 최대 ${AUCTION_MAX_ACTIVE_PER_USER}개까지 등록할 수 있습니다.`,
          errorCode: "AUCTION_ACTIVE_LIMIT_EXCEEDED",
        });
      }

      if (normalizedPhotos.length < 1 || normalizedPhotos.length > 5) {
        return res.status(400).json({
          success: false,
          error: "사진은 최소 1장, 최대 5장까지 등록할 수 있습니다.",
          errorCode: "AUCTION_INVALID_PHOTO_COUNT",
        });
      }

      const duplicatedAuction = await client.auction.findFirst({
        where: {
          userId: user.id,
          createdAt: {
            gte: new Date(Date.now() - AUCTION_DUPLICATE_GUARD_WINDOW_MS),
          },
          title: normalizedTitle,
          description: normalizedDescription,
          photos: { equals: normalizedPhotos },
          category: normalizedCategory,
          startPrice: normalizedStartPrice,
          endAt: endDate,
          sellerPhone: normalizedSellerPhone,
          sellerEmail: normalizedSellerEmail,
          sellerBlogUrl: normalizedSellerBlogUrl,
          sellerCafeNick: normalizedSellerCafeNick,
          sellerBandNick: normalizedSellerBandNick,
          sellerProofImage: normalizedSellerProofImage,
          sellerTrustNote: normalizedSellerTrustNote,
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (duplicatedAuction) {
        return res.status(409).json({
          success: false,
          error:
            "동일한 내용의 경매가 이미 등록되었습니다. 기존 경매를 공유하거나 수정해주세요.",
          errorCode: "AUCTION_DUPLICATE_RECENT",
          auctionId: duplicatedAuction.id,
        });
      }

      const auction = await client.auction.create({
        data: {
          title: normalizedTitle,
          description: normalizedDescription,
          photos: normalizedPhotos,
          category: normalizedCategory,
          sellerPhone: normalizedSellerPhone,
          sellerEmail: normalizedSellerEmail,
          sellerBlogUrl: normalizedSellerBlogUrl,
          sellerCafeNick: normalizedSellerCafeNick,
          sellerBandNick: normalizedSellerBandNick,
          sellerProofImage: normalizedSellerProofImage,
          sellerTrustNote: normalizedSellerTrustNote,
          startPrice: normalizedStartPrice,
          currentPrice: normalizedStartPrice,
          minBidIncrement,
          endAt: endDate,
          user: { connect: { id: user.id } },
        },
      });

      return res.json({ success: true, auction });
    } catch (error) {
      console.error("Auction create error:", error);
      return res.status(500).json({
        success: false,
        error: "경매 등록 중 오류가 발생했습니다.",
        errorCode: "AUCTION_CREATE_FAILED",
      });
    }
  }
}

export default withApiSession(
  withHandler({ methods: ["GET", "POST"], handler, isPrivate: false })
);
