import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { Product, User } from "@prisma/client";
import {
  PRODUCT_BLOODLINE_FORBIDDEN_MESSAGE,
  PRODUCT_INVALID_BLOODLINE_ROOT_MESSAGE,
  validateProductInput,
} from "@libs/productRules";
import { resolveCategoryIdByName } from "@libs/server/categories";
import { excludedAuthorIds } from "@libs/server/blocks";
import {
  canAttachBloodline,
  getBloodlineLinkSummary,
  pedigreeNoteDbValue,
  readStoredPedigreeNote,
} from "@libs/server/bloodline-link";
import { captureServerEvent } from "@libs/server/analytics";
import {
  PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
  type PedigreeNote,
} from "@libs/shared/pedigree-note";
import type { BloodlineLinkSummary } from "@libs/shared/bloodline-card";

export interface ProductWithUser extends Omit<Product, "pedigreeNote" | "bloodlineRootId"> {
  user: User;
  /** 연결한 뿌리 혈통 id. 새 응답 필드라 optional 이다(구 응답·테스트 픽스처 호환). */
  bloodlineRootId?: number | null;
  /** 부·모 크기·누대(규칙에 맞는 키만). 혈통을 붙이지 않았으면 null. */
  pedigreeNote?: PedigreeNote | null;
  /**
   * 상세 GET 에서만: 연결한 혈통 요약. 연결이 없거나 혈통이 ACTIVE 가 아니면(회수·숨김) null.
   * 뷰어와 무관한 값이라 웹 SSR(비로그인 fetch)과 같은 결과다.
   */
  bloodline?: BloodlineLinkSummary | null;
}

export interface ItemDetailResponse {
  success: boolean;
  error?: string;
  product?: ProductWithUser;
  relatedProducts?: Product[];
  isLiked?: boolean;
  hasPurchased?: boolean; // 현재 유저가 이 상품을 구매확정 했는지
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id },
    user,
  } = req;

  // GET 요청에서는 body가 없으므로 안전하게 처리
  const action = req.body?.action;
  const data = req.body?.data;

  const productId = id?.toString()?.split("-")[0];
  const parsedProductId = Number(productId);

  if (req.method === "GET") {
    console.info("[api/products/:id][start]", {
      rawId: id,
      parsedProductId,
      method: req.method,
      vercelId: req.headers["x-vercel-id"] || null,
      userId: user?.id ?? null,
    });
  }

  const product = await client.product.findUnique({
    where: {
      id: parsedProductId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      _count: {
        select: {
          favs: true,
        },
      },
    },
  });

  if (!product) {
    if (req.method === "GET") {
      const latest = await client.product.findMany({
        take: 5,
        orderBy: { id: "desc" },
        select: { id: true, name: true, userId: true, createdAt: true },
      });
      console.warn("[api/products/:id][not-found]", {
        rawId: id,
        parsedProductId,
        latestProducts: latest,
      });
    }
    return res.status(404).json({
      success: false,
      message: "상품을 찾을 수 없습니다.",
    });
  }

  // 삭제한 상품은 수정·상태 변경·구매확정·재삭제를 막는다(조회는 아래 GET 규칙대로 소유자만).
  if (req.method === "POST" && product.isDeleted) {
    return res.status(404).json({
      success: false,
      message: "삭제된 상품입니다.",
      errorCode: "PRODUCT_DELETED",
    });
  }

  if (req.method === "GET") {
    console.info("[api/products/:id][found]", {
      id: product.id,
      userId: product.userId,
      name: product.name,
      status: product.status,
    });

    // 숨김(관리자 조치·탈퇴)·삭제 상품은 소유자에게만 보인다.
    // 웹 상세 페이지(SSR, libs/server/apis.ts getProduct)는 Authorization 없이 조회하므로
    // 소유자 예외는 토큰을 보내는 클라이언트(앱, 웹 클라이언트 SWR)에만 적용된다.
    // 관리자는 숨김 상품도 본다(숨김 해제 조치를 위해). 삭제 상품은 관리자에게도 404.
    const canSeeHidden = user?.id === product.userId || isModeratorUser(user);
    if (
      (product.isDeleted && user?.id !== product.userId) ||
      (product.isHidden && !canSeeHidden)
    ) {
      return res.status(404).json({
        success: false,
        error: "삭제되었거나 숨겨진 상품입니다.",
        errorCode: "PRODUCT_HIDDEN",
      });
    }
    const [isLikedResult, hasPurchasedResult, bloodline] = await Promise.all([
      // 비로그인이면 조회하지 않는다. userId: undefined 는 Prisma 가 조건을 무시해
      // 다른 사람의 찜이 잡힌다(#139).
      user?.id
        ? client.fav.findFirst({
            where: { productId: product.id, userId: user.id },
            select: { id: true },
          })
        : null,
      user?.id
        ? client.purchase.findFirst({
            where: { productId: product.id, userId: user.id },
            select: { id: true },
          })
        : null,
      // 연결한 혈통 요약(판매자 관계 포함). ACTIVE 가 아니면 null 이라 상세에서 행이 사라진다.
      // 곁가지 정보라 조회가 실패해도 상품 상세는 그대로 준다(행만 빠진다).
      product.bloodlineRootId
        ? getBloodlineLinkSummary(product.bloodlineRootId, product.userId).catch((error) => {
            console.error("[api/products/:id][bloodline-summary]", error);
            return null;
          })
        : null,
    ]);

    const isLiked = Boolean(isLikedResult);
    const hasPurchased = Boolean(hasPurchasedResult);

    const terms = product.name.split(" ").map((word) => ({
      name: {
        contains: word,
      },
    }));

    // 연관 상품도 목록과 같이 숨김·삭제 상품과 viewer 가 차단한 판매자의 상품을 뺀다.
    const excluded = await excludedAuthorIds(user?.id);
    const relatedProducts = await client.product.findMany({
      where: {
        OR: terms,
        AND: {
          id: {
            not: product.id,
          },
        },
        isHidden: false,
        isDeleted: false,
        ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      },
      take: 20,
    });

    return res.json({
      success: true,
      product: {
        ...product,
        pedigreeNote: readStoredPedigreeNote(product.pedigreeNote),
        bloodline,
      },
      isLiked,
      hasPurchased,
      relatedProducts,
    });
  }

  if (req.method === "POST") {
    switch (action) {
      // 구매확정 (구매자 전용 - 판매완료 상태인 상품만)
      case "purchase": {
        if (!user?.id) {
          return res.status(401).json({ success: false, message: "로그인이 필요합니다." });
        }
        if (product.user.id === user.id) {
          return res.status(400).json({ success: false, message: "자신의 상품은 구매할 수 없습니다." });
        }
        if (product.status !== "판매완료") {
          return res.status(400).json({ success: false, message: "판매완료된 상품만 구매확정할 수 있습니다." });
        }
        // 이미 구매확정 했는지 확인
        const existingPurchase = await client.purchase.findFirst({
          where: { productId: product.id, userId: user.id },
        });
        if (existingPurchase) {
          return res.status(400).json({ success: false, message: "이미 구매확정한 상품입니다." });
        }
        await client.purchase.create({
          data: {
            userId: user.id,
            productId: product.id,
            status: "completed",
          },
        });
        return res.json({ success: true });
      }

      // 아래 액션들은 판매자만 가능
      default:
        break;
    }

    // 판매자 전용 액션
    if (product.user.id !== user?.id) {
      return res.status(403).json({ success: false, message: "권한이 없습니다." });
    }

    switch (action) {
      // 소프트 삭제: 목록·검색·관심목록에서는 빠지고 판매·구매 기록은 남는다.
      case "delete":
        await client.product.update({
          where: { id: Number(productId) },
          data: { isDeleted: true },
        });
        return res.json({ success: true });

      case "update": {
        if (!data || typeof data !== "object") {
          return res.status(400).json({
            success: false,
            message: "수정할 내용이 없습니다.",
            errorCode: "PRODUCT_UPDATE_EMPTY",
          });
        }
        // 등록과 같은 규칙. 보내지 않은 필드는 기존 값을 유지한다.
        const validation = validateProductInput(data, { partial: true });
        if (!validation.ok) {
          return res.status(400).json({
            success: false,
            error: validation.message,
            message: validation.message,
            errorCode: validation.errorCode,
          });
        }
        const { photos, bloodlineRootId, pedigreeNote } = validation.value;
        const storedRootId = product.bloodlineRootId ?? null;

        // 부모 정보만 보내면 이미 붙어 있는 혈통이 있어야 한다.
        if (bloodlineRootId === undefined && pedigreeNote && !storedRootId) {
          return res.status(400).json({
            success: false,
            error: PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
            message: PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
            errorCode: "PRODUCT_PEDIGREE_WITHOUT_BLOODLINE",
          });
        }

        // 새 혈통을 붙이거나 바꿀 때만 권한을 본다. 이미 붙어 있던 혈통을 그대로 보내는 수정은
        // (그 뒤 혈통을 넘겼거나 회수됐어도) 가격·설명 수정을 막지 않는다.
        let attachRelation: "mine" | "received" | null = null;
        if (typeof bloodlineRootId === "number" && bloodlineRootId !== storedRootId) {
          const decision = await canAttachBloodline(bloodlineRootId, user.id);
          if (!decision.ok) {
            const notFound = decision.reason === "not_found";
            const message = notFound
              ? PRODUCT_INVALID_BLOODLINE_ROOT_MESSAGE
              : PRODUCT_BLOODLINE_FORBIDDEN_MESSAGE;
            return res.status(notFound ? 400 : 403).json({
              success: false,
              error: message,
              message,
              errorCode: notFound
                ? "PRODUCT_INVALID_BLOODLINE_ROOT"
                : "PRODUCT_BLOODLINE_FORBIDDEN",
            });
          }
          attachRelation = decision.relation;
        }

        const updatedProduct = await client.product.update({
          where: { id: Number(productId) },
          data: {
            name: validation.value.name,
            price: validation.value.price,
            description: validation.value.description,
            photos,
            category: validation.value.category,
            ...(validation.value.category !== undefined
              ? { categoryId: await resolveCategoryIdByName(validation.value.category) }
              : {}),
            productType: validation.value.productType,
            dealType: validation.value.dealType,
            // 사진을 보냈으면 대표 이미지도 첫 장으로 맞춘다(등록과 같은 규칙).
            ...(photos ? { mainImage: photos[0] ?? null } : {}),
            // 혈통은 보낸 때만 바꾼다(구 앱 수정은 기존 값 유지). null 이면 해제 + 부모 정보도 지움.
            ...(bloodlineRootId !== undefined ? { bloodlineRootId } : {}),
            ...(pedigreeNote !== undefined
              ? { pedigreeNote: pedigreeNoteDbValue(pedigreeNote) }
              : {}),
          },
        });

        // 혈통이 없던 상품에 새로 붙였을 때만 계측한다(응답 직전, 1.5초 상한, 실패해도 무시).
        if (typeof bloodlineRootId === "number" && !storedRootId && attachRelation) {
          const attachedNote = pedigreeNote !== undefined
            ? pedigreeNote
            : readStoredPedigreeNote(product.pedigreeNote);
          await captureServerEvent(user.id, "product_bloodline_attached", {
            product_id: product.id,
            bloodline_id: bloodlineRootId,
            relation: attachRelation,
            has_pedigree: Boolean(attachedNote),
            generation: attachedNote?.generation ?? null,
          });
        }
        return res.json({ success: true, product: updatedProduct });
      }

      // 상태 변경 (판매중/예약중)
      case "status_change": {
        const newStatus = data?.status;
        if (!["판매중", "예약중"].includes(newStatus)) {
          return res.status(400).json({ success: false, message: "유효하지 않은 상태입니다." });
        }
        await client.product.update({
          where: { id: Number(productId) },
          data: { status: newStatus },
        });
        return res.json({ success: true });
      }

      // 판매완료 처리 (Sale 레코드 생성 + 상태 변경)
      case "sold": {
        // 이미 판매완료 레코드가 있는지 확인
        const existingSale = await client.sale.findFirst({
          where: { productId: product.id, userId: user!.id },
        });
        if (existingSale) {
          return res.status(400).json({ success: false, message: "이미 판매완료 처리된 상품입니다." });
        }
        await client.$transaction([
          client.product.update({
            where: { id: Number(productId) },
            data: { status: "판매완료" },
          }),
          client.sale.create({
            data: {
              userId: user!.id,
              productId: product.id,
              status: "completed",
            },
          }),
        ]);
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ success: false, message: "잘못된 요청입니다." });
    }
  }
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
