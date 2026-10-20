import type { Metadata } from "next";
import Layout from "@components/features/MainLayout";
import JsonLd from "@components/atoms/JsonLd";
import DownloadLanding from "@components/features/landing/DownloadLanding";
import { APP_STORE_URL, DOWNLOAD_PAGE_PATH, PLAY_STORE_URL } from "@libs/shared/appLinks";
import { SITE_NAME, SITE_URL } from "@libs/shared/seo";

/**
 * 앱 소개·다운로드 랜딩(2026-10-20 iOS·Android 출시). 공유용이라 미리보기 이미지·문구를 따로 둔다.
 * web-only: 스토어로 보내는 페이지라 앱 안에는 없다(docs/parity §5 SEO·공유).
 */
const canonical = `${SITE_URL}${DOWNLOAD_PAGE_PATH}`;
const title = "브리디 앱 — 곤충·파충류·물고기 키우는 사람들이 모이는 곳";
const description = "사진 기록, 질문·토론, 분양·경매, 혈통카드까지. 브리디를 앱스토어와 구글 플레이에서 무료로 받아 보세요.";
const ogImage = { url: `${SITE_URL}/landing/og.jpg`, width: 1200, height: 630, alt: "브리디 — 곤충·파충류·물고기, 키우는 사람들이 모이는 곳" };

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical },
  openGraph: { type: "website", title, description, url: canonical, siteName: SITE_NAME, images: [ogImage] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage.url] },
};

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: SITE_NAME,
  operatingSystem: "iOS, Android",
  applicationCategory: "SocialNetworkingApplication",
  description,
  url: canonical,
  image: ogImage.url,
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
  sameAs: [APP_STORE_URL, PLAY_STORE_URL],
};

export default function DownloadPage() {
  return (
    <>
      <JsonLd id="download-app-jsonld" data={appJsonLd} />
      <Layout headerVariant="none" seoTitle="브리디 앱 다운로드" bodyHasH1>
        <DownloadLanding />
      </Layout>
    </>
  );
}
