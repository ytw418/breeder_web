import React from "react";
import RankingClient from "./RankingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "인기 랭킹 | 브리디",
  description:
    "브리디 유저 랭킹과 인기 곤충·변이 콘텐츠를 확인하세요. 기간별/카테고리별 순위를 한눈에 비교할 수 있습니다.",
  keywords: ["브리디 랭킹", "최고 랭킹", "인기 게시글", "곤충", "변이"],
  alternates: {
    canonical: "https://bredy.app/ranking",
  },
  openGraph: {
    title: "인기 랭킹 | 브리디",
    description: "브리디 랭킹 페이지에서 인기 콘텐츠와 사용자 순위를 확인하세요.",
    type: "website",
    url: "https://bredy.app/ranking",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디 랭킹 페이지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "인기 랭킹 | 브리디",
    description: "인기 랭킹, 유저 순위와 변이 순위를 확인하세요.",
    images: ["/opengraph-image"],
  },
};

const page = () => {
  return <RankingClient />;
};

export default page;
