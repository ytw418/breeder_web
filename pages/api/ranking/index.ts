import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { InsectRecord, Like, Post, User } from "@prisma/client";

/** 기네스북 기록 응답 */
export interface RecordWithUser extends InsectRecord {
  user: Pick<User, "id" | "name" | "avatar">;
}

/** 브리디 랭킹 응답 */
export interface BredyRank {
  user: Pick<User, "id" | "name" | "avatar">;
  totalLikes: number;
  recordCount: number;
  auctionCount: number;
  score: number;
}

/** 멋진 곤충 / 변이 랭킹 (좋아요 기반 게시글) */
export interface PostRank extends Post {
  user: Pick<User, "id" | "name" | "avatar">;
  _count: { Likes: number };
}

export interface RankingResponse {
  success: boolean;
  error?: string;
  // 기네스북
  records?: RecordWithUser[];
  // 브리디 랭킹
  bredyRanking?: BredyRank[];
  // 멋진 곤충 / 변이 랭킹 (좋아요 기반 게시글)
  postRanking?: PostRank[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const { tab, period = "all", species } = req.query;

  try {
    // 기간 필터 (이번 달/올해)
    const now = new Date();
    const monthStart =
      period === "monthly" ? new Date(now.getFullYear(), now.getMonth(), 1) : undefined;
    const yearStart =
      period === "yearly" ? new Date(now.getFullYear(), 0, 1) : undefined;
    const periodStart = monthStart || yearStart;

    /** 1) 기네스북 (곤충 크기/무게 기록) */
    if (tab === "guinness") {
      const where: any = { isVerified: true };
      if (species && species !== "전체") where.species = String(species);
      if (periodStart) where.createdAt = { gte: periodStart };

      const records = await client.insectRecord.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { value: "desc" },
        take: 50,
      });

      return res.json({ success: true, records });
    }

    /** 2) 멋진 곤충 랭킹 (사진 카테고리 좋아요순) */
    if (tab === "coolInsect") {
      const where: any = { category: "사진" };
      if (periodStart) where.createdAt = { gte: periodStart };

      const postRanking = await client.post.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { Likes: true } },
        },
        orderBy: { Likes: { _count: "desc" } },
        take: 50,
      });

      return res.json({ success: true, postRanking });
    }

    /** 3) 인기 게시글 (전체 카테고리 좋아요순) */
    if (tab === "popular") {
      const where: any = { NOT: { category: "공지" } };
      if (periodStart) where.createdAt = { gte: periodStart };

      const postRanking = await client.post.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { Likes: true } },
        },
        orderBy: [{ _count: { Likes: "desc" as const } }, { createdAt: "desc" as const }],
        take: 50,
      });

      return res.json({ success: true, postRanking });
    }

    /** 3) 변이 랭킹 (변이 카테고리 좋아요순) */
    if (tab === "mutation") {
      const where: any = { category: "변이" };
      if (periodStart) where.createdAt = { gte: periodStart };

      const postRanking = await client.post.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { Likes: true } },
        },
        orderBy: { Likes: { _count: "desc" } },
        take: 50,
      });

      return res.json({ success: true, postRanking });
    }

    /** 4) 최고 브리디 랭킹 (종합 점수) */
    if (tab === "bredy") {
      // 유저별 점수 계산을 위해 관련 데이터 조회
      const users = await client.user.findMany({
        select: {
          id: true,
          name: true,
          avatar: true,
          _count: {
            select: {
              insectRecords: true,
              auctions: true,
              followers: true,
            },
          },
        },
      });

      // 유저별 좋아요 수 (사진/변이 게시글)
      const userLikes = await client.like.groupBy({
        by: ["userId"],
        where: {
          post: { category: { in: ["사진", "변이"] } },
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
        },
        _count: { id: true },
      });

      const likesMap = new Map(userLikes.map((l) => [l.userId, l._count.id]));

      // 점수 계산: 기록 x 30 + 좋아요 x 5 + 경매 x 20 + 팔로워 x 10
      const bredyRanking: BredyRank[] = users
        .map((u) => {
          const totalLikes = likesMap.get(u.id) || 0;
          return {
            user: { id: u.id, name: u.name, avatar: u.avatar },
            totalLikes,
            recordCount: u._count.insectRecords,
            auctionCount: u._count.auctions,
            score:
              u._count.insectRecords * 30 +
              totalLikes * 5 +
              u._count.auctions * 20 +
              u._count.followers * 10,
          };
        })
        .filter((b) => b.score > 0) // 점수 0인 유저 제외
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

      return res.json({ success: true, bredyRanking });
    }

    // 기본: 전체 탭 없으면 에러
    return res.status(400).json({ success: false, error: "tab 파라미터가 필요합니다." });
  } catch (error) {
    console.error("Ranking API error:", error);
    return res.status(500).json({ success: false, error: "랭킹 조회 중 오류가 발생했습니다." });
  }
}

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: false })
);
