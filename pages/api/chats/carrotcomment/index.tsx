import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { productId, buyerId, sellerId },
  } = req;

  const carrotComment = await client.carrotComment.findFirst({
    where: {
      productId: Number(productId),
      carrotcommentbuyerId: Number(buyerId),
      carrotcommentsellerId: Number(sellerId),
    },
  });

  res.json({ success: true, carrotComment });
}

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: true })
);
