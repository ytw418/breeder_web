import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Auction, User } from "@prisma/client";

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
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  // 경매 목록 조회
  if (req.method === "GET") {
    const { page = 1, status, category } = req.query;

    const where: any = {};
    if (status && status !== "전체") where.status = String(status);
    if (category && category !== "전체") where.category = String(category);

    // 종료 시간이 지난 진행중 경매는 자동으로 종료 처리
    await client.auction.updateMany({
      where: {
        status: "진행중",
        endAt: { lte: new Date() },
      },
      data: { status: "종료" },
    });

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
      return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
    }

    const { title, description, photos, category, startPrice, minBidIncrement, endAt } = req.body;

    // 유효성 검사
    if (!title || !description || !startPrice || !endAt) {
      return res.status(400).json({ success: false, error: "필수 항목을 모두 입력해주세요." });
    }

    const endDate = new Date(endAt);
    if (endDate <= new Date()) {
      return res.status(400).json({ success: false, error: "종료 시간은 현재 이후여야 합니다." });
    }

    try {
      const auction = await client.auction.create({
        data: {
          title,
          description,
          photos: photos || [],
          category: category || null,
          startPrice: Number(startPrice),
          currentPrice: Number(startPrice),
          minBidIncrement: Number(minBidIncrement) || 1000,
          endAt: endDate,
          user: { connect: { id: user.id } },
        },
      });

      return res.json({ success: true, auction });
    } catch (error) {
      console.error("Auction create error:", error);
      return res.status(500).json({ success: false, error: "경매 등록 중 오류가 발생했습니다." });
    }
  }
}

export default withApiSession(
  withHandler({ methods: ["GET", "POST"], handler, isPrivate: false })
);
