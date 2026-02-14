import type { Metadata } from "next";
import CreateAuctionClient from "../../../auctions/create/CreateAuctionClient";

export const metadata: Metadata = {
  title: "경매 생성하기 | 경매 폼 생성기",
  description: "링크 공유형 경매를 빠르게 생성하는 등록 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://bredy.app/auctions/create",
  },
};

export default function ToolCreateAuctionPage() {
  return <CreateAuctionClient />;
}
