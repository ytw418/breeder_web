import { Suspense } from "react";
import type { Metadata } from "next";

import AllPostsClient from "./AllPostsClient";

// 제목 뒤 ' | 브리디' 는 루트 layout 의 title.template 이 붙인다.
export const metadata: Metadata = {
  title: "반려동물 커뮤니티 게시글 — 정보·자유·질문",
  description:
    "브리디 브리더들이 올린 정보·자유·질문·자랑·후기·변이 게시글을 인기순·댓글순·최신순으로 모아 봐요.",
  // 카테고리·정렬을 바꾼 주소(?category=&sort=)는 모두 이 주소 하나로 모은다.
  alternates: { canonical: "https://bredy.app/posts/all" },
};

const page = () => (
  // ?category=&sort= 를 읽어 Suspense 로 감싼다.
  <Suspense fallback={null}>
    <AllPostsClient />
  </Suspense>
);

export default page;
