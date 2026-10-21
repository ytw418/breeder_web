import { NextApiRequest, NextApiResponse } from "next";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { notifyFollowers } from "@libs/server/notification";
import { fetchProductsResponse, PRICE_FILTER_MAX } from "@libs/server/home";
import {
  PRODUCT_BLOODLINE_FORBIDDEN_MESSAGE,
  PRODUCT_INVALID_BLOODLINE_ROOT_MESSAGE,
  validateProductInput,
} from "@libs/productRules";
import { setViewerCacheHeader } from "@libs/server/blocks";
import { resolveCategoryIdByName } from "@libs/server/categories";
import { DEFAULT_DEAL_TYPE } from "@libs/shared/categories";
import { canAttachBloodline, pedigreeNoteDbValue } from "@libs/server/bloodline-link";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
import { buildCelebrate } from "@libs/server/celebrate";
import { getProductRail, PRODUCT_RAIL_LIMIT_DEFAULT, PRODUCT_RAIL_LIMIT_MAX } from "@libs/server/productRail";
import { assertWriteAllowed } from "@libs/server/writeLimits";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "POST") {
    const {
      body: {
        name,
        price,
        description,
        photos,
        category,
        productType,
        dealType,
        bloodlineRootId,
        pedigreeNote,
      },
      user,
    } = req;

    if (!user?.id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // 웹·앱 등록 화면 모두 카테고리·상품 타입을 필수로 보낸다.
    const validation = validateProductInput(
      {
        name,
        price,
        description,
        photos,
        category,
        productType,
        dealType,
        bloodlineRootId,
        pedigreeNote,
      },
      { requireCategory: true }
    );
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        error: validation.message,
        message: validation.message,
        errorCode: validation.errorCode,
      });
    }

    // 혈통은 보낸 때만 붙인다(구 앱은 보내지 않아 null). 지금 보유한 혈통이나 출처 카드를 받은 혈통만.
    const linkedRootId = validation.value.bloodlineRootId ?? null;
    const linkedPedigree = linkedRootId ? validation.value.pedigreeNote ?? null : null;
    let attachRelation: "mine" | "received" | null = null;
    if (linkedRootId) {
      const decision = await canAttachBloodline(linkedRootId, user.id);
      if (!decision.ok) {
        const notFound = decision.reason === "not_found";
        const message = notFound
          ? PRODUCT_INVALID_BLOODLINE_ROOT_MESSAGE
          : PRODUCT_BLOODLINE_FORBIDDEN_MESSAGE;
        return res.status(notFound ? 400 : 403).json({
          success: false,
          error: message,
          message,
          errorCode: notFound ? "PRODUCT_INVALID_BLOODLINE_ROOT" : "PRODUCT_BLOODLINE_FORBIDDEN",
        });
      }
      attachRelation = decision.relation;
    }

    // 가입 7일 미만 하루 3개(경매 합계)·같은 설명 10분 3번(감사 24번). 운영자·크루는 제외.
    const writeLimit = await assertWriteAllowed({
      userId: user.id,
      kind: "product",
      text: validation.value.description,
    });
    if (writeLimit) {
      return res.status(writeLimit.status).json({
        success: false,
        error: writeLimit.error,
        message: writeLimit.error,
        errorCode: writeLimit.errorCode,
      });
    }

    const product = await client.product.create({
      data: {
        name: validation.value.name!,
        price: validation.value.price!,
        description: validation.value.description!,
        photos: validation.value.photos ?? [],
        category: validation.value.category!,
        // 카테고리 고정 범위 조회용 id. 문자열 category 와 같은 종을 가리킨다.
        categoryId: await resolveCategoryIdByName(validation.value.category),
        productType: validation.value.productType!,
        dealType: validation.value.dealType ?? DEFAULT_DEAL_TYPE,
        mainImage: validation.value.photos?.[0] || null,
        bloodlineRootId: linkedRootId,
        ...(linkedPedigree ? { pedigreeNote: pedigreeNoteDbValue(linkedPedigree) } : {}),
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    // 팔로워들에게 새 상품 등록 알림
    const seller = await client.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    if (seller) {
      notifyFollowers({
        senderId: user.id,
        type: "NEW_PRODUCT",
        message: `${seller.name}님이 새 분양글을 등록했습니다:${product.name}`,
        targetId: product.id,
        targetType: "product",
      });
    }

    // 계측은 응답 직전에 기다린다(서버리스는 응답 뒤 작업을 보장하지 않는다. 1.5초 상한, 실패해도 무시).
    await captureServerEvent(user.id, "product_created", {
      product_id: product.id,
      category: product.category,
      deal_type: product.dealType,
      product_type: product.productType,
      photo_count: product.photos.length,
      has_bloodline: Boolean(linkedRootId),
      platform: resolveClientPlatform(req),
    });
    if (linkedRootId && attachRelation) {
      await captureServerEvent(user.id, "product_bloodline_attached", {
        product_id: product.id,
        bloodline_id: linkedRootId,
        relation: attachRelation,
        has_pedigree: Boolean(linkedPedigree),
        generation: linkedPedigree?.generation ?? null,
      });
    }

    // 등록 보상 시트(앱 community-vibe §3.4). 실패하면 null.
    const celebrate = await buildCelebrate({
      target: "product",
      id: product.id,
      userId: user.id,
      createdAt: product.createdAt,
      species: product.category ?? null,
      categoryId: product.categoryId ?? null,
    });

    return res.json({
      success: true,
      product,
      celebrate,
    });
  }

  if (req.method === "GET") {
    // 홈 '지금 올라온 분양' 레일: GET /api/products?rail=1&limit=10 → { success, items(isNew·pinnedFirst) }.
    if (req.query.rail === "1") {
      const rawLimit = Number(req.query.limit);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, PRODUCT_RAIL_LIMIT_MAX)
        : PRODUCT_RAIL_LIMIT_DEFAULT;
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      // 로그인 viewer 는 본인 첫 글 고정·차단 반영이 들어가 공유 캐시에 남기지 않는다.
      setViewerCacheHeader(res, req.user?.id);
      const items = await getProductRail({
        limit,
        viewerId: req.user?.id,
        categoryPath: typeof req.query.categoryPath === "string" ? req.query.categoryPath : undefined,
      });
      return res.json({ success: true, items });
    }

    const {
      query: {
        page = 1,
        size = 10,
        category,
        productType,
        status,
        price,
        minPrice,
        maxPrice,
        sort,
        categoryPath,
        bloodlineRootId,
      },
    } = req;

    // 캐싱 전략: 필터 없는 기본 목록은 60초 캐시
    // 필터가 있는 경우 30초 캐시
    // price·minPrice·maxPrice 는 0 이상의 정수 문자열만 받는다(홈 무료 분양 카드 → price=0).
    // INT4 최대값보다 크면 그 값으로 자른다(그보다 비싼 상품은 DB 에 없다).
    // sort 는 latest(기본)·popular·priceAsc·priceDesc. 앱 상품 목록 정렬에 쓴다.
    const toPrice = (value: unknown) =>
      typeof value === "string" && /^\d+$/.test(value)
        ? Math.min(Number(value), PRICE_FILTER_MAX)
        : undefined;
    const priceFilter = toPrice(price);
    const minPriceFilter = toPrice(minPrice);
    const maxPriceFilter = toPrice(maxPrice);
    const sortValue = typeof sort === "string" ? sort : undefined;
    // 혈통 상세 "이 혈통 분양글" 목록. 양의 정수 문자열만 받고, 아니면 필터를 붙이지 않는다.
    // INT4 최대값(PRICE_FILTER_MAX 와 같은 값)보다 크면 그 값으로 자른다(그런 id 는 없어 빈 목록이다).
    const bloodlineRootFilter =
      typeof bloodlineRootId === "string" && /^\d+$/.test(bloodlineRootId) && Number(bloodlineRootId) > 0
        ? Math.min(Number(bloodlineRootId), PRICE_FILTER_MAX)
        : undefined;
    const hasFilters =
      (category && category !== "전체") ||
      (typeof categoryPath === "string" && categoryPath) ||
      productType ||
      status ||
      priceFilter !== undefined ||
      minPriceFilter !== undefined ||
      maxPriceFilter !== undefined ||
      bloodlineRootFilter !== undefined ||
      (sortValue && sortValue !== "latest");
    const cacheTime = hasFilters ? 30 : 60;
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
    );
    // 로그인 viewer 는 차단한 판매자의 상품이 빠진 응답을 받으므로 공유 캐시에 남기지 않는다.
    const viewerId = req.user?.id;
    setViewerCacheHeader(res, viewerId);

    const response = await fetchProductsResponse({
      page: Number(page),
      size: Number(size),
      category: typeof category === "string" ? category : undefined,
      categoryPath: typeof categoryPath === "string" ? categoryPath : undefined,
      productType: typeof productType === "string" ? productType : undefined,
      status: typeof status === "string" ? status : undefined,
      price: priceFilter,
      minPrice: minPriceFilter,
      maxPrice: maxPriceFilter,
      sort: sortValue,
      bloodlineRootId: bloodlineRootFilter,
      viewerId,
    });

    return res.json(response);
  }
};

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler: withDetailRevalidation(handler, () => [{ type: "HOME" }]),
  })
);
