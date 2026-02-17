import BredybookLandingClient from "./BredybookLandingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "브리디북 소개 | 브리디",
  description:
    "브리디북의 기록 방식과 반려곤충 데이터 축적 방법을 소개합니다. 브리디북을 시작해 반려곤충 기록을 체계적으로 관리하세요.",
  alternates: {
    canonical: "https://bredy.app/bredybook-landing",
  },
  openGraph: {
    title: "브리디북 소개 | 브리디",
    description: "브리디북은 반려곤충 기록과 수집 정보를 한 곳에서 정리합니다.",
    type: "website",
    url: "https://bredy.app/bredybook-landing",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디북 소개 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "브리디북 소개 | 브리디",
    description: "브리디북을 통해 반려곤충 기록을 시작하세요.",
    images: ["/opengraph-image"],
  },
};

const BredybookLandingPage = () => {
  return <BredybookLandingClient />;
};

export default BredybookLandingPage;
