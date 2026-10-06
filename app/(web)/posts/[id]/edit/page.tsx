import AuthGuard from "@components/auth/AuthGuard";
import type { Metadata } from "next";
import EditPostClient from "./EditPostClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "게시글 수정 | 브리디",
  description: "작성한 게시글을 수정하는 페이지입니다.",
};

export default function EditPostPage() {
  return (
    <AuthGuard>
      <EditPostClient />
    </AuthGuard>
  );
}
