import type { Metadata } from "next";
import Link from "next/link";
import Layout from "@components/features/MainLayout";

// notFound() 와 없는 주소 모두 여기로 온다(HTTP 404 유지).
// 앱의 "불러올 수 없음" 상태와 같은 모양: 제목 + 설명 + 보조 버튼.
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Layout canGoBack showHome title="" seoTitle="페이지를 찾을 수 없어요">
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-app-bg px-4 py-12 text-center">
        <h1 className="text-[18px] font-bold tracking-[-0.3px] text-app-text">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-2 text-[14px] leading-[1.5] text-app-muted">
          삭제되었거나 주소가 바뀌었을 수 있어요.
          <br />
          주소를 다시 확인해 주세요.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-app-surface px-[18px] text-[14px] font-semibold text-app-text"
        >
          홈으로
        </Link>
      </div>
    </Layout>
  );
}
