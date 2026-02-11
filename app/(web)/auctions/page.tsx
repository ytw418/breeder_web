import React from "react";
import type { Metadata } from "next";
import AuctionsClient from "./AuctionsClient";

export const metadata: Metadata = {
  title: "진행중 경매",
  description:
    "브리디 링크형 경매 도구로 진행 중인 경매를 확인하고 바로 참여해보세요.",
  openGraph: {
    title: "진행중 경매 | 브리디 경매도구",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 진행 중인 경매를 확인하고 즉시 참여할 수 있습니다.",
    type: "website",
    images: [
      {
        url: "/auction-tool/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디 진행중 경매 공유 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "진행중 경매 | 브리디 경매도구",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 진행 중인 경매를 확인하고 즉시 참여할 수 있습니다.",
    images: ["/auction-tool/twitter-image"],
  },
};

const page = () => {
  return <AuctionsClient />;
};

export default page;
