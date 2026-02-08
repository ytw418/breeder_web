import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    session: { user },
  } = req;

  if (!user?.id) {
    return res.status(401).json({ success: false, message: "로그인이 필요합니다." });
  }

  const productId = Number(id.toString().split("-")[0]);

  if (isNaN(productId)) {
    return res.status(400).json({ success: false, message: "유효하지 않은 상품 ID입니다." });
  }

  // 상품 존재 여부 확인
  const product = await client.product.findUnique({
    where: { id: productId },
    select: { id: true, userId: true },
  });

  if (!product) {
    return res.status(404).json({ success: false, message: "상품을 찾을 수 없습니다." });
  }

  try {
    const alreadyExists = await client.fav.findFirst({
      where: {
        productId,
        userId: user.id,
      },
    });

    if (alreadyExists) {
      // 관심목록에서 제거
      await client.fav.delete({
        where: { id: alreadyExists.id },
      });
      return res.json({ success: true, action: "removed" });
    } else {
      // 관심목록에 추가
      await client.fav.create({
        data: {
          user: { connect: { id: user.id } },
          product: { connect: { id: productId } },
        },
      });

      // 찜 알림 생성 (상품 등록자에게, 본인 상품이 아닌 경우)
      if (product.userId !== user.id) {
        const senderUser = await client.user.findUnique({
          where: { id: user.id },
          select: { name: true },
        });

        if (senderUser) {
          createNotification({
            type: "FAV",
            userId: product.userId,
            senderId: user.id,
            message: `${senderUser.name}님이 회원님의 상품을 찜했습니다.`,
            targetId: productId,
            targetType: "product",
          });
        }
      }

      return res.json({ success: true, action: "added" });
    }
  } catch (error) {
    console.error("Fav toggle error:", error);
    return res.status(500).json({ success: false, message: "관심목록 처리 중 오류가 발생했습니다." });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
