import type { Metadata } from "next";
import NoticePostsClient from "./NoticePostsClient";

export const metadata: Metadata = {
  title: "공지사항",
  description: "브리디 공지사항만 모아볼 수 있는 페이지입니다.",
  alternates: {
    canonical: "https://bredy.app/posts/notices",
  },
};

export default function NoticePostsPage() {
  return <NoticePostsClient />;
}
