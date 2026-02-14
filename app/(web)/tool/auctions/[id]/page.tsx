import type { Metadata } from "next";
import AuctionDetailClient from "../../../auctions/[id]/AuctionDetailClient";

interface Props {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `경매 상세 | 경매 폼 생성기`,
    description: "경매 상세 확인 및 입찰 화면입니다.",
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `https://bredy.app/auctions/${params.id}`,
    },
  };
}

export default function ToolAuctionDetailPage() {
  return <AuctionDetailClient />;
}
