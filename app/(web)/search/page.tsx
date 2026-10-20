import { Suspense } from "react";
import SearchClient, { SearchClientFromUrl } from "./SearchClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "검색",
  description: "브리디 내부 검색 결과 페이지입니다.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/** `?q=&type=` 를 화면에서 읽는다(검색 결과 주소 공유·뒤로 오기). 정적 HTML 은 빈 검색 화면이다. */
const SearchPage = () => {
  return (
    <Suspense fallback={<SearchClient />}>
      <SearchClientFromUrl />
    </Suspense>
  );
};

export default SearchPage;
