import type { Metadata } from "next";
import { SITE_OG_IMAGE } from "@libs/shared/ogImage";
import { Suspense } from "react";
import SupportClient, { SupportForm } from "./SupportClient";

export const metadata: Metadata = {
  title: "고객센터",
  description:
    "브리디 서비스 이용 중 버그 제보, 기능 요청, 문의가 필요한 경우 고객센터에 남겨 주세요.",
  keywords: ["브리디 고객지원", "문의", "버그 제보", "기능 요청"],
  openGraph: {
    title: "고객센터 | 브리디",
    description:
      "브리디 서비스에 대한 문의, 버그 제보, 기능 요청을 접수할 수 있습니다.",
    url: "https://bredy.app/support",
    type: "website",
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "브리디 고객센터 페이지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "고객센터 | 브리디",
    description: "문의/버그 제보가 필요한 사항을 쉽게 남겨보세요.",
    images: [SITE_OG_IMAGE],
  },
  alternates: {
    canonical: "https://bredy.app/support",
  },
};

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportForm />}>
      <SupportClient />
    </Suspense>
  );
}
