import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Product, User } from "@prisma/client";

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
    session: { user },
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

  if (req.method === "GET") {
    console.info("[api/products/:id][found]", {
      id: product.id,
      userId: product.userId,
      name: product.name,
      status: product.status,
    });
    const [isLikedResult, hasPurchasedResult] = await Promise.all([
      client.fav.findFirst({
        where: { productId: product.id, userId: user?.id },
        select: { id: true },
      }),
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

    const relatedProducts = await client.product.findMany({
      where: {
        OR: terms,
        AND: {
          id: {
            not: product.id,
          },
        },
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
      case "delete":
        await client.product.delete({
          where: { id: Number(productId) },
        });
        return res.json({ success: true });

      case "update":
        const updatedProduct = await client.product.update({
          where: { id: Number(productId) },
          data: {
            name: data.name,
            price: data.price,
            description: data.description,
            photos: data.photos,
          },
        });
        return res.json({ success: true, product: updatedProduct });

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

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
