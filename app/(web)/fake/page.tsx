import type { Metadata } from "next";

import FakePageClient from "./FakePageClient";

export const metadata: Metadata = {
  title: "FAKE 사용자 전환",
  description: "테스트 및 개발 환경 전용 계정 전환 페이지",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const FakePage = () => {
  return <FakePageClient />;
};

export default FakePage;
