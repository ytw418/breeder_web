import { MetadataRoute } from "next";
import client from "@libs/server/client";
import { getProductPath } from "@libs/product-route";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 정적 페이지 URL
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://bredy.app",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://bredy.app/auctions",
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: "https://bredy.app/auctions/rules",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: "https://bredy.app/posts",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://bredy.app/ranking",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://bredy.app/support",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.45,
    },
    {
      url: "https://bredy.app/auction-tool",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://bredy.app/guinness",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.55,
    },
    {
      url: "https://bredy.app/bredybook-landing",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.55,
    },
  ];

  if (!process.env.DATABASE_URL) {
    return staticPages;
  }

  try {
    // 상품 페이지 URL
    const products = await client.product.findMany({
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });

    const productPages: MetadataRoute.Sitemap = products.map((product) => ({
      url: `https://bredy.app${getProductPath(product.id, product.name)}`,
      lastModified: product.updatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    }));

    const auctions = await client.auction.findMany({
      select: {
        id: true,
        updatedAt: true,
      },
      where: {
        status: {
          in: ["진행중", "종료", "유찰"],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const auctionPages: MetadataRoute.Sitemap = auctions.map((auction) => ({
      url: `https://bredy.app/auctions/${auction.id}`,
      lastModified: auction.updatedAt,
      changeFrequency: "hourly",
      priority: 0.85,
    }));

    const posts = await client.post.findMany({
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    });

    const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `https://bredy.app/posts/${post.id}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly",
      priority: 0.65,
    }));

    return [...staticPages, ...productPages, ...auctionPages, ...postPages];
  } catch {
    return staticPages;
  }
}
