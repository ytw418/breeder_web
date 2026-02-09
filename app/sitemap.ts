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
      url: "https://bredy.app/products/[id]",
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: "https://bredy.app/chat",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://bredy.app/profiles/[id]",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // 상품 페이지 URL
  const products = await client.product.findMany({
    select: {
      id: true,
      updatedAt: true,
      name: true,
    },
  });

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `https://bredy.app/products/${product.id}-${product.name}`,
    lastModified: product.updatedAt,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  return [...staticPages, ...productPages];
}
