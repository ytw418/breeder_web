import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { getCategorySearchKeywords } from "@libs/categoryTaxonomy";

export interface SearchResponse {
  success: boolean;
  error?: string;
  products: {
    id: number;
    name: string;
    price: number | null;
    photos: string[];
    category: string | null;
    productType: string | null;
    status: string;
    createdAt: string;
    user: {
      id: number;
      name: string;
      avatar: string | null;
    };
    _count: { favs: number };
  }[];
  posts: {
    id: number;
    title: string;
    description: string;
    image: string;
    category: string | null;
    createdAt: string;
    user: {
      id: number;
      name: string;
      avatar: string | null;
    };
    _count: { Likes: number; comments: number };
  }[];
  users: {
    id: number;
    name: string;
    avatar: string | null;
  }[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>
) {
  try {
    const { query: { q, type = "all" } } = req;
    const normalizedType =
      typeof type === "string" && ["all", "products", "posts", "users"].includes(type)
        ? type
        : "all";

    if (!q || (q as string).trim() === "") {
      return res.json({
        success: true,
        products: [],
        posts: [],
        users: [],
      });
    }

    const keyword = (q as string).trim();
    const categoryKeywords = getCategorySearchKeywords(keyword);

    // 상품 검색
    const products =
      normalizedType === "all" || normalizedType === "products"
        ? await client.product.findMany({
            where: {
              OR: [
                { name: { contains: keyword, mode: "insensitive" } },
                { description: { contains: keyword, mode: "insensitive" } },
                { category: { contains: keyword, mode: "insensitive" } },
                ...(categoryKeywords.length
                  ? [{ category: { in: categoryKeywords } }]
                  : []),
              ],
            },
            select: {
              id: true,
              name: true,
              price: true,
              photos: true,
              category: true,
              productType: true,
              status: true,
              createdAt: true,
              user: {
                select: { id: true, name: true, avatar: true },
              },
              _count: { select: { favs: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : [];

    // 게시글 검색
    const posts =
      normalizedType === "all" || normalizedType === "posts"
        ? await client.post.findMany({
            where: {
              category: { not: "공지" },
              OR: [
                { title: { contains: keyword, mode: "insensitive" } },
                { description: { contains: keyword, mode: "insensitive" } },
                { type: { contains: keyword, mode: "insensitive" } },
                ...(categoryKeywords.length
                  ? [{ type: { in: categoryKeywords } }]
                  : []),
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              image: true,
              category: true,
              createdAt: true,
              user: {
                select: { id: true, name: true, avatar: true },
              },
              _count: { select: { Likes: true, comments: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : [];

    // 유저 검색
    const users =
      normalizedType === "all" || normalizedType === "users"
        ? await client.user.findMany({
            where: {
              name: { contains: keyword, mode: "insensitive" },
            },
            select: {
              id: true,
              name: true,
              avatar: true,
            },
            take: 10,
          })
        : [];

    return res.json({
      success: true,
      products: products.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      users,
    });
  } catch (error) {
    console.error("Error in search handler:", error);
    return res.status(500).json({
      success: false,
      error: "검색 중 오류가 발생했습니다.",
      products: [],
      posts: [],
      users: [],
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
