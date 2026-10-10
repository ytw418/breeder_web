import React from "react";
import PostsClient from "./PostsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "반려생활 게시글 | 브리디",
  description:
    "브리디 반려생활 게시판의 최신 글을 모아서 확인하세요. 분양 후기, 거래 팁, 커뮤니티 소식까지 한 곳에서 빠르게 찾아봅니다.",
  keywords: ["반려생활", "브리디 게시판", "게시글", "반려동물 커뮤니티"],
  alternates: {
    canonical: "https://bredy.app/posts",
  },
  openGraph: {
    title: "반려생활 게시글 | 브리디",
    description: "브리디 반려생활 게시판 최신 글 모음입니다.",
    type: "website",
    url: "https://bredy.app/posts",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디 반려생활 게시글 목록",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "반려생활 게시글 | 브리디",
    description: "반려생활 관련 소식과 게시글을 한 곳에서 확인하세요.",
    images: ["/opengraph-image"],
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** ?category=동네 처럼 들어오면 그 칩으로 시작한다(홈 '동네 사랑방'). 주소는 클라이언트가 한 번 읽고 지운다. */
const page = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const { category } = await searchParams;
  return <PostsClient initialCategory={typeof category === "string" ? category : undefined} />;
};

export default page;
