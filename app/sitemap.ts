import { MetadataRoute } from "next";
import client from "@libs/server/client";

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
  ];

  // 상품 페이지 URL
  const products = await client.product.findMany({
    select: {
      id: true,
      updatedAt: true,
    },
  });

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `https://bredy.app/products/${product.id}`,
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

  return [...staticPages, ...productPages, ...auctionPages];
}
