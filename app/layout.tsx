import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { VariousProvider } from "@libs/client/VariousProvider";
import ClientComp from "./ClientComp";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@components/features/theme-provider";
import AppToastContainer from "@components/features/AppToastContainer";

const inter = Inter({ subsets: ["latin"] });
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const siteUrl = "https://bredy.app";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Bredy",
  url: siteUrl,
  description: "반려동물 링크형 경매와 거래 도구를 제공하는 커뮤니티 플랫폼",
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Bredy",
  url: siteUrl,
  logo: `${siteUrl}/images/pwa/icon-512.png`,
  sameAs: ["https://www.instagram.com/bredy_breeder"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bredy | 애완동물 서비스",
    template: "%s | Bredy",
  },
  description:
    "애완동물 서비스 브리디에서 링크형 경매 도구와 거래 기능을 쉽고 신뢰감 있게 시작해보세요.",
  keywords: [
    "브리디",
    "애완동물 서비스",
    "링크형 경매",
    "경매 도구",
    "카카오 로그인",
    "안전 거래",
    "반려동물",
    "중고 거래",
  ],
  authors: [{ name: "Bredy Team" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://bredy.app",
    siteName: "Bredy",
    title: "Bredy | 애완동물 서비스",
    description:
      "애완동물 서비스 브리디에서 링크형 경매 도구와 거래 기능을 쉽고 신뢰감 있게 시작해보세요.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디 애완동물 서비스 공유 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bredy | 애완동물 서비스",
    description:
      "애완동물 서비스 브리디에서 링크형 경매 도구와 거래 기능을 쉽고 신뢰감 있게 시작해보세요.",
    images: ["/twitter-image"],
    site: "@bredy",
    creator: "@bredy",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "YV_Riopc7DmVS7LUL6geEhhs2DmQghxBUUBoeuTWhR0",

    other: {
      "naver-site-verification": "7f6743de2fa3d6b5a9eea0f841b8e35bc57ee644",
    },
  },
  alternates: {
    canonical: "https://bredy.app",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bredy",
  },
  icons: {
    icon: [
      { url: "/images/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/images/pwa/icon-192.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta
          name="naver-site-verification"
          content="7f6743de2fa3d6b5a9eea0f841b8e35bc57ee644"
        />
        <meta
          name="google-site-verification"
          content="YV_Riopc7DmVS7LUL6geEhhs2DmQghxBUUBoeuTWhR0"
        />
        <meta
          name="google-adsense-account"
          content="ca-pub-8957945516038764"
        ></meta>
        <meta name="mobile-web-app-capable" content="yes" />
        <Script
          id="website-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />
        <Script
          id="organization-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        {posthogKey ? (
          <Script
            id="posthog-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session reset alias set_config set_persistence opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_session_replay_url".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(
                posthogKey
              )},{api_host:${JSON.stringify(
                posthogHost
              )},capture_pageview:true,capture_pageleave:true,defaults:'2026-01-30'});`,
            }}
          />
        ) : null}
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <VariousProvider>
            <ClientComp />
            <Analytics />
            {children}
          </VariousProvider>
          <AppToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
