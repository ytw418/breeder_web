import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import MySellHistoryList from "../../../../components/features/profile/MySellHistoryList";

interface Sale {
  id: number;
  userId: number;
  productId: number;
  createdAt: Date;
  product: {
    id: number;
    name: string;
    price: number | null;
    description: string;
    photos: string[];
    createdAt: Date;
    _count: {
      favs: number;
    };
  };
}

export interface MySellHistoryResponseType {
  success: boolean;
  mySellHistoryData: Sale[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType>
) {
  const {
    query: { id },
  } = req;

  const mySellHistoryData = await client.sale.findMany({
    where: {
      userId: Number(id),
    },
    include: {
      product: {
        include: {
          _count: {
            select: {
              favs: true,
            },
          },
        },
      },
    },
  });
  res.json({
    success: true,
    mySellHistoryData,
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
