import React from "react";
import MainClient from "./MainClient";
import type { Metadata } from "next";
import { SITE_OG_IMAGE } from "@libs/shared/ogImage";

export const metadata: Metadata = {
  // 레이아웃 템플릿(' | 브리디')을 붙이면 '브리디'가 두 번 나온다. 홈만 제목을 그대로 쓴다.
  title: { absolute: "브리디 | 곤충·파충류·물고기, 키우는 사람들이 모이는 곳" },
  description:
    "곤충·파충류·물고기 키우는 사람들이 모이는 곳. 실시간 토론과 질문, 동네 브리더, 분양까지 브리디에서 한 번에.",
  openGraph: {
    title: "브리디 | 곤충·파충류·물고기, 키우는 사람들이 모이는 곳",
    description:
      "곤충·파충류·물고기 키우는 사람들이 모이는 곳. 실시간 토론과 질문, 동네 브리더, 분양까지 브리디에서 한 번에.",
    url: "https://bredy.app",
    siteName: "Bredy",
    type: "website",
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "브리디 - 브리더들의 SNS. 분양·거래·랭킹·무료경매·동네 브리더 찾기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "브리디 | 곤충·파충류·물고기, 키우는 사람들이 모이는 곳",
    description:
      "곤충·파충류·물고기 키우는 사람들이 모이는 곳. 실시간 토론과 질문, 동네 브리더, 분양까지 브리디에서 한 번에.",
    images: [SITE_OG_IMAGE],
  },
  alternates: {
    canonical: "https://bredy.app",
  },
};

/**
 * 메인 페이지 ISR: 60초마다 다시 만든다. 홈 v2(앱 docs/prd/home-v2.md)는 인기글 TOP 10·피드를 화면에서 받으므로
 * 서버에서 미리 읽는 값은 없다. 토론·동네·랭킹·배너는 반려생활 탭(/life)이 미리 읽는다.
 */
export const revalidate = 60;

const page = () => <MainClient />;

export default page;
