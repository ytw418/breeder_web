import GuinnessClient from "./GuinnessClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "브리디북 랭킹 | 브리디",
  description:
    "브리디북 상위 기록과 인기 곤충·변이 순위를 확인할 수 있는 페이지입니다.",
  alternates: {
    canonical: "https://bredy.app/guinness",
  },
  openGraph: {
    title: "브리디북 랭킹 | 브리디",
    description: "브리디북 기록과 랭킹을 한눈에 조회하세요.",
    type: "website",
    url: "https://bredy.app/guinness",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디북 랭킹 페이지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "브리디북 랭킹 | 브리디",
    description: "브리디북 기록과 랭킹을 한눈에 확인하세요.",
    images: ["/opengraph-image"],
  },
};

export default function GuinnessPage() {
  return <GuinnessClient />;
}
