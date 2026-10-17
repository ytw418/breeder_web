import { MetadataRoute } from "next";
import client from "@libs/server/client";
import { getProductPath } from "@libs/product-route";
import { toAuctionPath } from "@libs/auction-route";
import { toPostPath } from "@libs/post-route";

/** 빌드 때 한 번 만들고 끝나지 않도록 1시간마다 다시 만든다(그 전엔 배포 뒤 올라온 글이 빠졌다). */
export const revalidate = 3600;

const SITEMAP_POST_LIMIT = 20000;
const SITEMAP_PROFILE_LIMIT = 10000;

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
    // 분양 탭(2026-10-15 홈 구성 A안). 옛 /posts 는 홈으로 리다이렉트한다.
    {
      url: "https://bredy.app/products",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://bredy.app/debates",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
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
      url: "https://bredy.app/account-deletion",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
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
    // 상품 페이지 URL. 숨김·삭제 상품은 상세가 404 라 넣지 않는다.
    const products = await client.product.findMany({
      where: { isHidden: false, isDeleted: false },
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
        title: true,
        updatedAt: true,
      },
      where: {
        isHidden: false,
        status: {
          in: ["진행중", "종료", "유찰"],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const auctionPages: MetadataRoute.Sitemap = auctions.map((auction) => ({
      url: `https://bredy.app${toAuctionPath(auction.id, auction.title)}`,
      lastModified: auction.updatedAt,
      changeFrequency: "hourly",
      priority: 0.85,
    }));

    const posts = await client.post.findMany({
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
      where: { isHidden: false },
      orderBy: {
        updatedAt: "desc",
      },
      // 사이트맵 한 파일은 5만 줄까지다. 넘기 전에 generateSitemaps 로 나눈다.
      take: SITEMAP_POST_LIMIT,
    });

    const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `https://bredy.app${toPostPath(post.id, post.title)}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly",
      priority: 0.65,
    }));

    // 글·분양글이 하나라도 있는 프로필만(빈 프로필은 noindex — profiles/[id]/page.tsx).
    const profiles = await client.user.findMany({
      select: { id: true, updatedAt: true },
      where: {
        status: { notIn: ["DELETED", "BANNED"] },
        OR: [
          { posts: { some: { isHidden: false } } },
          { products: { some: { isHidden: false, isDeleted: false } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: SITEMAP_PROFILE_LIMIT,
    });

    const profilePages: MetadataRoute.Sitemap = profiles.map((profile) => ({
      url: `https://bredy.app/profiles/${profile.id}`,
      lastModified: profile.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...staticPages, ...productPages, ...auctionPages, ...postPages, ...profilePages];
  } catch {
    return staticPages;
  }
}
