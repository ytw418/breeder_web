import React from "react";
import MainClient from "./MainClient";
import type { Metadata } from "next";
import { getHomeBanners, getHomeFeed, getProductsResponse } from "@libs/server/home";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";

export const metadata: Metadata = {
  title: "브리디 | 반려동물 경매 플랫폼",
  description:
    "브리디는 반려동물 경매, 혈통카드, 상품 공유 기능을 한 번에 이용할 수 있는 링크형 경매 플랫폼입니다. 내 상품과 인기 게시글을 빠르게 확인하세요.",
  openGraph: {
    title: "브리디 | 반려동물 경매 플랫폼",
    description:
      "반려동물 커뮤니티와 링크형 경매 기능을 한 곳에서. 인기 경매, 혈통카드, 커뮤니티 소식을 한 번에 확인하세요.",
    url: "https://bredy.app",
    siteName: "Bredy",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디 반려동물 경매 플랫폼",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "브리디 | 반려동물 경매 플랫폼",
    description:
      "브리디에서 반려동물 거래와 경매 도구를 빠르게 시작하세요.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://bredy.app",
  },
};

/**
 * 메인 페이지 ISR 설정
 * - 60초마다 페이지 재생성
 * - 자주 변경되는 인기 콘텐츠를 적절한 주기로 업데이트
 */
export const revalidate = 3600; // 1시간

const page = async () => {
  // 피드·상품 집계가 실패해도 페이지는 그린다. 클라이언트가 다시 받아 스켈레톤·오류 상태를 보인다.
  const [initialHomeFeed, initialProducts, initialBanners] = await Promise.all([
    getHomeFeed({ includePersonalized: false }).catch(() => null),
    getProductsResponse({ page: 1, size: 10 }).catch(() => null),
    getHomeBanners(),
  ]);

  // SWR fallbackData 로 그대로 쓰이므로 클라이언트 fetcher 와 같이 탈퇴 유저 이름을 정규화한다.
  return (
    <MainClient
      initialHomeFeed={initialHomeFeed ? normalizeDeletedUserNames(initialHomeFeed) : null}
      initialProducts={initialProducts ? normalizeDeletedUserNames(initialProducts) : null}
      initialBanners={initialBanners}
    />
  );
};

export default page;
