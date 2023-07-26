import ClientComp from "./ClientComp";
import "/styles/globals.css";

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
      <body className="bg-White font-pretendard text-Black">
        <ClientComp />
        {children}
      </body>
    </html>
  );
}
