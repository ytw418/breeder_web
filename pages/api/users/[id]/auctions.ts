import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

export interface UserAuctionsQuery {
  id?: string | string[];
  page?: string | string[];
  size?: string | string[];
  order?: string | string[];
}

export interface UserAuctionsResponse {
  success: boolean;
  auctions: {
    id: number;
    title: string;
    description: string;
    photos: string[];
    category: string | null;
    status: string;
    currentPrice: number;
    createdAt: string;
    _count: {
      bids: number;
    };
  }[];
  pages: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | UserAuctionsResponse>
) {
  const {
    query: { id = "", page = 1, size = 20, order = "desc" },
  } = req as { query: UserAuctionsQuery };

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "사용자 ID가 필요합니다.",
    });
  }

  if (order !== "asc" && order !== "desc") {
    return res.status(400).json({
      success: false,
      message: "정렬 순서는 'asc' 또는 'desc'만 가능합니다.",
    });
  }

  const pageSize = Math.min(Math.max(1, +size), 50);
  const pageNumber = Math.max(1, +page);
  const userId = +id.toString();

  const [auctions, count] = await Promise.all([
    client.auction.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        description: true,
        photos: true,
        category: true,
        status: true,
        currentPrice: true,
        createdAt: true,
        _count: {
          select: { bids: true },
        },
      },
      orderBy: {
        createdAt: order as "asc" | "desc",
      },
      take: pageSize,
      skip: (pageNumber - 1) * pageSize,
    }),
    client.auction.count({ where: { userId } }),
  ]);

  return res.json({
    success: true,
    auctions: auctions.map((auction) => ({
      ...auction,
      category: auction.category ?? null,
      currentPrice: auction.currentPrice ?? 0,
      createdAt: auction.createdAt.toISOString(),
      _count: { bids: auction._count.bids },
    })),
    pages: Math.ceil(count / pageSize),
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
