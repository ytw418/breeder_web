import React from "react";
import MainClient from "./MainClient";
import type { Metadata } from "next";
import { SITE_OG_IMAGE } from "@libs/shared/ogImage";
import { getHomeBanners, getHomeFeed } from "@libs/server/home";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";

export const metadata: Metadata = {
  title: "브리디 | 곤충·파충류·물고기, 키우는 사람들이 모이는 곳",
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
 * 메인 페이지 ISR: 60초마다 다시 만든다. 새 게시글·분양글·경매를 올리면 그 API 가 바로 다시 만든다
 * (libs/server/pageRevalidation.ts). 홈 피드는 이 HTML 의 값을 그대로 쓰고 화면에서 다시 받지 않으므로
 * (MainClient revalidateOnMount) 이 주기가 곧 홈 섹션이 늦게 보일 수 있는 최대 시간이다(전엔 1시간).
 */
export const revalidate = 60;

const page = async () => {
  // 피드 집계가 실패해도 페이지는 그린다. 클라이언트가 다시 받아 스켈레톤·오류 상태를 보인다.
  // 2026-10-15 홈 구성 A안(docs/prd/home-ia.md): 홈 = 커뮤니티. 분양 목록은 /products(분양 탭)가 그린다.
  const [initialHomeFeed, initialBanners] = await Promise.all([
    getHomeFeed({ includePersonalized: false }).catch(() => null),
    getHomeBanners(),
  ]);

  // SWR fallbackData 로 그대로 쓰이므로 클라이언트 fetcher 와 같이 탈퇴 유저 이름을 정규화한다.
  return (
    <MainClient
      initialHomeFeed={initialHomeFeed ? normalizeDeletedUserNames(initialHomeFeed) : null}
      initialBanners={initialBanners}
    />
  );
};

export default page;
