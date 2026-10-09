import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { Auction, User } from "@prisma/client";
import {
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MAX_ACTIVE_PER_USER,
  AUCTION_MIN_START_PRICE,
  AUCTION_BID_INCREMENT_RANGE_TEXT,
  isAuctionDurationValid,
  isBidIncrementValid,
  getBidIncrement,
  readRequestedBidIncrement,
  AUCTION_PHOTOS_MAX,
  AUCTION_PHOTOS_MIN,
} from "@libs/auctionRules";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { normalizeOptionalText, normalizeOptionalUrl } from "@libs/shared/normalize";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";
import { resolveCategoryIdByName, resolveScopeCategoryIds } from "@libs/server/categories";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { excludedAuthorIds, setViewerCacheHeader } from "@libs/server/blocks";
import { canAttachBloodline, pedigreeNoteDbValue } from "@libs/server/bloodline-link";
import { captureServerEvent } from "@libs/server/analytics";
import {
  parsePedigreeNote,
  PEDIGREE_NOTE_INVALID_MESSAGE,
  PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
} from "@libs/shared/pedigree-note";

/** 경매 목록 응답 타입 */
export interface AuctionWithUser extends Auction {
  user: Pick<User, "id" | "name" | "avatar"> & {
    breederPrograms: BreederProgramSummary[];
  };
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
/** Prisma Int(INT4) 최대값. 이보다 큰 혈통 id 는 잘못된 값(null)으로 본다. */
const INT4_MAX = 2_147_483_647;
const TOOL_MODE_COOKIE = "bredy_tool_mode";
const TOOL_FIXED_CATEGORY = "기타";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  // 경매 목록 조회
  if (req.method === "GET") {
    const { page = 1, status, category, q, categoryPath } = req.query;

    // 운영자가 숨긴 경매는 목록에서 모두에게 뺀다(작성자는 프로필에서 본다).
    const where: any = { isHidden: false };
    if (status && status !== "전체") where.status = String(status);
    if (category && category !== "전체") {
      where.category = { in: getCategoryFilterValues(String(category)) };
    }
    // 관심 카테고리 범위(구조만): 보낼 때만 거른다. 앱·웹은 CATEGORY_SCOPE_SURFACES.auctions 가 켜지면 보낸다.
    const scopeIds = await resolveScopeCategoryIds(categoryPath);
    if (scopeIds) where.categoryId = { in: scopeIds };
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

    // viewer 가 차단한 판매자의 경매는 viewer 에게서만 뺀다(목록·페이지 수 모두).
    const viewerId = req.user?.id;
    const excluded = await excludedAuthorIds(viewerId);
    if (excluded.length) {
      where.userId = { notIn: excluded };
    }
    setViewerCacheHeader(res, viewerId);

    const [auctions, auctionCount] = await Promise.all([
      client.auction.findMany({
        where,
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
          _count: { select: { bids: true } },
        },
        // 판매자 연락처는 목록에 싣지 않는다(상세에서 판매자·낙찰자에게만 보인다).
        omit: { sellerPhone: true, sellerEmail: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: page ? (+page - 1) * 10 : 0,
      }),
      client.auction.count({ where }),
    ]);

    const serializedAuctions = auctions.map((auction) => {
      // omit 을 따르지 않는 경로(테스트 목 등)에서도 연락처가 새지 않게 한 번 더 뺀다.
      const rest: Record<string, unknown> = { ...auction };
      delete rest.sellerPhone;
      delete rest.sellerEmail;
      return {
        ...(rest as typeof auction),
        user: {
          ...auction.user,
          breederPrograms: getSortedActiveBreederProgramSummaries(
            auction.user.breederPrograms
          ),
        },
      };
    });

    return res.json({
      success: true,
      auctions: serializedAuctions,
      pages: Math.ceil(auctionCount / 10),
    });
  }

  // 경매 등록
  if (req.method === "POST") {
    const {
      user,
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
      bloodlineRootId,
      minBidIncrement: requestedBidIncrement,
      pedigreeNote: requestedPedigreeNote,
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
    const parsedBloodlineRootId = Number(bloodlineRootId);
    const normalizedBloodlineRootId =
      Number.isInteger(parsedBloodlineRootId) &&
      parsedBloodlineRootId > 0 &&
      parsedBloodlineRootId <= INT4_MAX
        ? parsedBloodlineRootId
        : null;
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

    // 입찰 단위는 판매자가 정한다. 보내지 않는 구 앱은 예전처럼 시작가 구간값으로 등록한다.
    const minBidIncrement =
      readRequestedBidIncrement(requestedBidIncrement) ?? getBidIncrement(normalizedStartPrice);
    if (!isBidIncrementValid(minBidIncrement)) {
      return res.status(400).json({
        success: false,
        error: `최소 입찰 단위는 ${AUCTION_BID_INCREMENT_RANGE_TEXT}로 정해주세요.`,
        errorCode: "AUCTION_INVALID_BID_INCREMENT",
      });
    }

    // 부·모 크기·누대. 구 앱은 보내지 않는다. 혈통을 안 보냈는데 부모 정보만 오면 400,
    // 혈통이 비어 있으면(잘못된 id 포함) 부모 정보도 저장하지 않는다.
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
    const linkedPedigree = normalizedBloodlineRootId ? pedigree.value : null;

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

      // 붙일 수 있는 혈통: 지금 보유한 혈통 또는 그 뿌리의 출처 카드를 받은 혈통(libs/server/bloodline-link).
      // 만든 사람이라도 혈통을 넘긴 뒤에는 못 붙인다. 오류 코드는 그대로다(앱·웹이 코드로 문구를 고른다).
      let attachRelation: "mine" | "received" | null = null;
      if (normalizedBloodlineRootId) {
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
          // 종료 시각은 비교하지 않는다. 등록 화면의 기간 프리셋은 "지금+N시간"이라
          // 같은 경매를 다시 보내면 종료 시각만 달라진다(#140).
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
          categoryId: await resolveCategoryIdByName(normalizedCategory),
          sellerPhone: normalizedSellerPhone,
          sellerEmail: normalizedSellerEmail,
          sellerBlogUrl: normalizedSellerBlogUrl,
          sellerCafeNick: normalizedSellerCafeNick,
          sellerBandNick: normalizedSellerBandNick,
          sellerProofImage: normalizedSellerProofImage,
          sellerTrustNote: normalizedSellerTrustNote,
          bloodlineRootId: normalizedBloodlineRootId,
          ...(linkedPedigree ? { pedigreeNote: pedigreeNoteDbValue(linkedPedigree) } : {}),
          startPrice: normalizedStartPrice,
          currentPrice: normalizedStartPrice,
          minBidIncrement,
          endAt: endDate,
          user: { connect: { id: user.id } },
        },
      });

      // 계측은 응답 직전에 기다린다(1.5초 상한, 실패해도 무시).
      if (normalizedBloodlineRootId && attachRelation) {
        await captureServerEvent(user.id, "auction_bloodline_attached", {
          auction_id: auction.id,
          bloodline_id: normalizedBloodlineRootId,
          relation: attachRelation,
          has_pedigree: Boolean(linkedPedigree),
          generation: linkedPedigree?.generation ?? null,
        });
      }

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

export default withAuth(
  withHandler({ methods: ["GET", "POST"], handler, isPrivate: false })
);
