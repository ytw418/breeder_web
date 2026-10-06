import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { Product, User } from "@prisma/client";
import { validateProductInput } from "@libs/productRules";
import { excludedAuthorIds } from "@libs/server/blocks";

export interface ProductWithUser extends Product {
  user: User;
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
    if ((product.isHidden || product.isDeleted) && user?.id !== product.userId) {
      return res.status(404).json({
        success: false,
        error: "삭제되었거나 숨겨진 상품입니다.",
        errorCode: "PRODUCT_HIDDEN",
      });
    }
    const [isLikedResult, hasPurchasedResult] = await Promise.all([
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
      product,
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
        const { photos } = validation.value;
        const updatedProduct = await client.product.update({
          where: { id: Number(productId) },
          data: {
            name: validation.value.name,
            price: validation.value.price,
            description: validation.value.description,
            photos,
            category: validation.value.category,
            productType: validation.value.productType,
            // 사진을 보냈으면 대표 이미지도 첫 장으로 맞춘다(등록과 같은 규칙).
            ...(photos ? { mainImage: photos[0] ?? null } : {}),
          },
        });
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
