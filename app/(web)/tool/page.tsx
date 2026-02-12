import Link from "next/link";
import type { Metadata } from "next";

const TOOL_OG_IMAGE = "/designer/og/tool-og-static.png";
const TOOL_TWITTER_IMAGE = "/designer/og/tool-og-static.png";

export const metadata: Metadata = {
  title: "경매 폼 생성기",
  description:
    "로그인 후 경매를 등록하고 공유 링크로 참여를 받는 간단한 경매 폼 생성기입니다.",
  alternates: {
    canonical: "https://bredy.app/tool",
  },
  openGraph: {
    title: "경매 폼 생성기",
    description: "로그인 후 경매를 등록하고 링크로 공유하는 간단한 경매 폼 생성기",
    type: "website",
    url: "https://bredy.app/tool",
    images: [
      {
        url: TOOL_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "경매 폼 생성기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "경매 폼 생성기",
    description: "로그인 후 경매를 등록하고 링크로 공유하는 간단한 경매 폼 생성기",
    images: [TOOL_TWITTER_IMAGE],
  },
};

export default function ToolLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
        Auction Form Tool
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
        1분 만에 경매 생성하기
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        복잡한 요소 없이 경매 등록, 상세 확인, 알림 확인만 빠르게 사용할 수 있습니다.
      </p>

      <div className="mt-6 grid gap-2.5">
        <Link
          href="/tool/auctions/create"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white"
        >
          경매 등록 화면 열기
        </Link>
        <Link
          href="/tool/login"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
        >
          로그인
        </Link>
        <Link
          href="/tool/notifications"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
        >
          알림 확인
        </Link>
      </div>
    </main>
  );
}
