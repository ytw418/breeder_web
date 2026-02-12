import React from "react";
import type { Metadata } from "next";
import CreateAuctionClient from "./CreateAuctionClient";

const AUCTION_OG_IMAGE = "/designer/og/bredy-og-auction.png";

export const metadata: Metadata = {
  title: "경매 등록",
  description:
    "브리디 경매도구에서 상품 정보 입력 후 링크를 발급해 경매를 바로 시작해보세요.",
  alternates: {
    canonical: "https://bredy.app/auctions/create",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "경매 등록 | 브리디 경매도구",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 상품 등록 후 링크 공유만으로 경매를 시작할 수 있습니다.",
    type: "website",
    images: [
      {
        url: AUCTION_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "브리디 경매 등록 공유 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "경매 등록 | 브리디 경매도구",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 상품 등록 후 링크 공유만으로 경매를 시작할 수 있습니다.",
    images: [AUCTION_OG_IMAGE],
  },
};

const page = () => {
  return <CreateAuctionClient />;
};

export default page;
