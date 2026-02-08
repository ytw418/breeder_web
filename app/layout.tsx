import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import { VariousProvider } from "@libs/client/VariousProvider";
import ClientComp from "./ClientComp";
import { Analytics } from "@vercel/analytics/next";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Breeder - 외국곤충 전문 마켓",
    template: "%s | Breeder",
  },
  description:
    "외국곤충, 건조표본, 헤라클레스, 사슴벌레, 극태, 왕사, 장수풍뎅이 등 다양한 곤충을 구매하고 판매할 수 있는 전문 마켓플레이스",
  keywords: [
    "외곤",
    "외국곤충",
    "건조표본",
    "헤라클레스",
    "사슴벌레",
    "극태",
    "왕사",
    "장수풍뎅이",
    "곤충",
    "곤충표본",
    "곤충수집",
    "곤충쇼핑",
    "곤충판매",
    "곤충구매",
  ],
  authors: [{ name: "Breeder Team" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://breeder-web.vercel.app",
    siteName: "Breeder",
    title: "Breeder - 외국곤충 전문 마켓",
    description:
      "외국곤충, 건조표본, 헤라클레스, 사슴벌레, 극태, 왕사, 장수풍뎅이 등 다양한 곤충을 구매하고 판매할 수 있는 전문 마켓플레이스",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Breeder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Breeder - 외국곤충 전문 마켓",
    description:
      "외국곤충, 건조표본, 헤라클레스, 사슴벌레, 극태, 왕사, 장수풍뎅이 등 다양한 곤충을 구매하고 판매할 수 있는 전문 마켓플레이스",
    images: ["/og-image.png"],
    site: "@breeder",
    creator: "@breeder",
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
    canonical: "https://breeder-web.vercel.app",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
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
      </head>
      <body className={inter.className}>
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        > */}
        <VariousProvider>
          <ClientComp />
          <Analytics />
          {children}
        </VariousProvider>
        <ToastContainer
          position="bottom-center" // 토스트 알림이 화면 하단 중앙에 표시됩니다
          autoClose={2000} // 2초 후에 자동으로 토스트가 닫힙니다
          hideProgressBar={true} // 진행 상태 바를 숨깁니다
          newestOnTop // 새로운 토스트가 위에 표시되도록 하는 옵션 (현재 주석 처리됨)
          closeOnClick // 토스트를 클릭하면 닫힙니다
          rtl={false} // 오른쪽에서 왼쪽으로의 텍스트 방향을 비활성화합니다
          pauseOnFocusLoss // 창이 포커스를 잃을 때 토스트 타이머를 일시정지합니다
          draggable // 토스트를 드래그하여 닫을 수 있습니다
          pauseOnHover // 마우스를 올렸을 때 토스트 타이머를 일시정지합니다
          theme="light" // 밝은 테마를 사용합니다
        />
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
