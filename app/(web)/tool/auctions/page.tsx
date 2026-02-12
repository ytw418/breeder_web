import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "진행중 경매 | 경매 폼 생성기",
  description: "진행중인 경매 목록을 확인하고 상세로 이동합니다.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://bredy.app/auctions",
  },
};

export default function ToolAuctionsPage() {
  redirect("/tool/auctions/create");
}
