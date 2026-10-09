import type { Metadata } from "next";
import CommentsClient from "./CommentsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "댓글 | 브리디",
};

/** 쓴 댓글 목록(앱 profiles/[id]/comments.tsx). 사이드 메뉴 '내 댓글'로 들어온다. */
export default async function CommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommentsClient id={id} />;
}
