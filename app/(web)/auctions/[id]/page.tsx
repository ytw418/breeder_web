import React from "react";
import type { Metadata } from "next";
import AuctionDetailClient from "./AuctionDetailClient";

export async function generateMetadata(): Promise<Metadata> {
  const title = "브리디 경매 | 30초면 만드는 경매 도구";
  const description =
    "30초면 만드는 경매 도구를 활용해보세요. 카카오 로그인 기반 참여, 자동 연장, 신고/제재 처리까지 지원합니다.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: "/auction-tool/opengraph-image",
          width: 1200,
          height: 630,
          alt: "브리디 경매 공유 이미지",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/auction-tool/twitter-image"],
    },
  };
}

const page = () => {
  return <AuctionDetailClient />;
};

export default page;
