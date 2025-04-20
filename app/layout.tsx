import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "@components/features/theme-provider";
import { VariousProvider } from "@libs/client/VariousProvider";
import ClientComp from "./ClientComp";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Breeder",
  description: "Breeder Web Application",
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
