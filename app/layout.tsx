import { VariousProvider } from "@libs/client/VariousProvider";
import ClientComp from "./ClientComp";
import "/styles/globals.css";
import { ThemeProvider } from "@components/theme-provider";

export interface PageLayoutProps {
  children: React.ReactNode;
}

declare global {
  interface Window {
    Kakao: any;
    AppleID: any;
    dataLayer: any;
    currentPage: number;
    gtag: any;
  }
  interface RetainableProps {
    retainedPage: number;
  }
}

export default async function RootLayout({ children }: PageLayoutProps) {
  return (
    <html lang="ko">
      <head></head>
      <body>
        <div className="font-pretendard">
          <VariousProvider>
            <ClientComp />
            {children}
          </VariousProvider>
        </div>
      </body>
    </html>
  );
}
