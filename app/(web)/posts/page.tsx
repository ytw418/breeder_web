import React from "react";
import PostsClient from "./PostsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "반려생활 게시글 | 브리디",
  description:
    "브리디 반려생활 게시판의 최신 글을 모아서 확인하세요. 판매 후기, 거래 팁, 커뮤니티 소식까지 한 곳에서 빠르게 찾아봅니다.",
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

const page = () => {
  return <PostsClient />;
};

export default page;
