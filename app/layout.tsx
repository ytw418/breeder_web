import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "@components/features/theme-provider";
import { VariousProvider } from "@libs/client/VariousProvider";
import ClientComp from "./ClientComp";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Breeder - 반려동물 전문 커뮤니티",
    template: "%s | Breeder",
  },
  description: "반려동물 관련 상품을 쉽게 구매하고 판매할 수 있는 마켓플레이스",
  keywords: [
    "곤충",
    "외곤",
    "파충류",
    "건조표본",
    "헤라클레스",
    "사슴벌레",
    "극태",
    "왕사",
    "장수풍뎅이",
  ],
  authors: [{ name: "Breeder Team" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://breeder-web.vercel.app",
    siteName: "Breeder",
    title: "Breeder - 반려동물 전문 마켓",
    description:
      "반려동물 관련 상품을 쉽게 구매하고 판매할 수 있는 마켓플레이스",
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
    title: "Breeder - 반려동물 전문 마켓",
    description:
      "반려동물 관련 상품을 쉽게 구매하고 판매할 수 있는 마켓플레이스",
    images: ["/og-image.png"],
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
    google: "your-google-site-verification",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        > */}
        <VariousProvider>
          <ClientComp />
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
