import React from "react";
import type { Metadata } from "next";
import AuctionDetailClient from "./AuctionDetailClient";
import client from "@libs/server/client";

interface Props {
  params: {
    id: string;
  };
}

const CLOUDFLARE_IMAGE_BASE = "https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw";
const DEFAULT_AUCTION_IMAGE = "/designer/og/bredy-og-auction.png";

const toPublicImageUrl = (imageId: string | null | undefined) => {
  if (!imageId) return DEFAULT_AUCTION_IMAGE;
  if (imageId.startsWith("http://") || imageId.startsWith("https://")) {
    return imageId;
  }
  return `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const auctionId = Number(params.id.split("-")[0]);

  if (Number.isNaN(auctionId)) {
    return {
      title: "브리디 경매 | 30초면 만드는 경매 도구",
      description:
        "30초면 만드는 경매 도구를 활용해보세요. 카카오 로그인 기반 참여, 자동 연장, 신고/제재 처리까지 지원합니다.",
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        title: "브리디 경매 | 30초면 만드는 경매 도구",
        description:
          "30초면 만드는 경매 도구를 활용해보세요. 카카오 로그인 기반 참여, 자동 연장, 신고/제재 처리까지 지원합니다.",
        type: "website",
        images: [
          {
            url: DEFAULT_AUCTION_IMAGE,
            width: 1200,
            height: 630,
            alt: "브리디 경매 공유 이미지",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "브리디 경매 | 30초면 만드는 경매 도구",
        description:
          "30초면 만드는 경매 도구를 활용해보세요. 카카오 로그인 기반 참여, 자동 연장, 신고/제재 처리까지 지원합니다.",
        images: [DEFAULT_AUCTION_IMAGE],
      },
    };
  }

  const auction = await client.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      title: true,
      description: true,
      currentPrice: true,
      category: true,
      status: true,
      photos: true,
      endAt: true,
    },
  });

  if (!auction) {
    return {
      title: "경매를 찾을 수 없습니다",
      description: "요청한 경매를 찾을 수 없습니다.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const trimmedDescription =
    auction.description.length > 120
      ? `${auction.description.slice(0, 120)}...`
      : auction.description;

  const title = `${auction.title} | 브리디 경매`;
  const description = `${trimmedDescription} · 현재가 ${auction.currentPrice.toLocaleString()}원`;
  const ogImage = toPublicImageUrl(auction.photos?.[0]);

  return {
    title,
    description,
    keywords: ["브리디", "경매 도구", "링크형 경매", auction.title, auction.category]
      .filter(Boolean)
      .map((keyword) => String(keyword)),
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://bredy.app/auctions/${auction.id}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${auction.title} 경매 공유 이미지`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://bredy.app/auctions/${auction.id}`,
    },
  };
}

const page = () => {
  return <AuctionDetailClient />;
};

export default page;
