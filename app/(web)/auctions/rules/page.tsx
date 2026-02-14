import type { Metadata } from "next";
import AuctionRulesClient from "./AuctionRulesClient";

const AUCTION_OG_IMAGE = "/designer/og/bredy-og-auction.png";

export const metadata: Metadata = {
  title: "경매 운영 가이드",
  description:
    "브리디 경매 정책, 자동 연장 규칙, 신고 처리 기준을 한 번에 확인하세요.",
  openGraph: {
    title: "경매 운영 가이드 | 브리디 경매도구",
    description:
      "브리디 경매 정책, 자동 연장 규칙, 신고 처리 기준을 한 번에 확인하세요.",
    type: "website",
    images: [
      {
        url: AUCTION_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "브리디 경매 운영 가이드 공유 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "경매 운영 가이드 | 브리디 경매도구",
    description:
      "브리디 경매 정책, 자동 연장 규칙, 신고 처리 기준을 한 번에 확인하세요.",
    images: [AUCTION_OG_IMAGE],
  },
};

const page = () => {
  return <AuctionRulesClient />;
};

export default page;
