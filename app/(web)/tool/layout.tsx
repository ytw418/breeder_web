import React from "react";
import type { Metadata } from "next";

const TOOL_OG_IMAGE = "/designer/og/tool-og-static.png";
const TOOL_TWITTER_IMAGE = "/designer/og/tool-og-static.png";

export const metadata: Metadata = {
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

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
