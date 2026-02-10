import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { VariousProvider } from "@libs/client/VariousProvider";
import ClientComp from "./ClientComp";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@components/features/theme-provider";
import AppToastContainer from "@components/features/AppToastContainer";
const inter = Inter({ subsets: ["latin"] });

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
  metadataBase: new URL("https://bredy.app"),
  title: {
    default: "Bredy - 곤충 커뮤니티",
    template: "%s | Bredy",
  },
  description:
    "장수풍뎅이, 사슴벌레 등 다양한 곤충 정보와 기록, 커뮤니티 활동을 한 곳에서 확인할 수 있습니다.",
  keywords: [
    "곤충",
    "사슴벌레",
    "장수풍뎅이",
    "곤충기록",
    "곤충커뮤니티",
    "브리디",
    "Bredy",
  ],
  authors: [{ name: "Bredy Team" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://bredy.app",
    siteName: "Bredy",
    title: "Bredy - 곤충 커뮤니티",
    description:
      "장수풍뎅이, 사슴벌레 등 다양한 곤충 정보와 기록, 커뮤니티 활동을 한 곳에서 확인할 수 있습니다.",
    images: [
      {
        url: "https://bredy.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Bredy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bredy - 곤충 커뮤니티",
    description:
      "장수풍뎅이, 사슴벌레 등 다양한 곤충 정보와 기록, 커뮤니티 활동을 한 곳에서 확인할 수 있습니다.",
    images: ["https://bredy.app/og-image.png"],
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
      "naver-site-verification": "893792f973a4f49bf92ed203678ddc2bbc02eed6",
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
          content="893792f973a4f49bf92ed203678ddc2bbc02eed6"
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
