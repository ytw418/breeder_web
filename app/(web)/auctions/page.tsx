import React from "react";
import type { Metadata } from "next";
import AuctionsClient from "./AuctionsClient";
import Script from "next/script";
import client from "@libs/server/client";
import { toAuctionPath } from "@libs/auction-route";

const AUCTION_OG_IMAGE = "/designer/og/bredy-og-auction.png";
const SITE_URL = "https://bredy.app";

export const metadata: Metadata = {
  title: "진행중 경매 | 브리디",
  description:
    "브리디 링크형 경매 도구로 진행 중인 경매를 확인하고 바로 참여해보세요.",
  keywords: [
    "경매",
    "온라인 경매",
    "곤충 경매",
    "파충류 경매",
    "브리디 경매",
    "링크형 경매 도구",
  ],
  alternates: {
    canonical: `${SITE_URL}/auctions`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "진행중 경매 | 브리디",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 진행 중인 경매를 확인하고 즉시 참여할 수 있습니다.",
    type: "website",
    url: `${SITE_URL}/auctions`,
    images: [
      {
        url: AUCTION_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "브리디 진행중 경매 공유 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "진행중 경매 | 브리디",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 진행 중인 경매를 확인하고 즉시 참여할 수 있습니다.",
    images: [AUCTION_OG_IMAGE],
  },
};

/**
 * 경매 목록 페이지 ISR 설정
 * - 30초마다 페이지 재생성
 * - 진행중인 경매의 실시간성 유지를 위해 짧은 revalidate 시간 사용
 */
export const revalidate = 30;

const page = async () => {
  let auctions: Array<{ id: number; title: string }> = [];

  if (process.env.DATABASE_URL) {
    try {
      auctions = await client.auction.findMany({
        where: { status: "진행중" },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
    } catch {
      auctions = [];
    }
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "브리디 진행중 경매 목록",
    itemListElement: auctions.map((auction, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}${toAuctionPath(auction.id, auction.title)}`,
      name: auction.title,
    })),
  };

  return (
    <>
      <Script
        id="auctions-itemlist-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <AuctionsClient />
    </>
  );
};

export default page;
