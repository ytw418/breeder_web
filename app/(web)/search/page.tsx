import SearchClient from "./SearchClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "검색 | 브리디",
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

const SearchPage = () => {
  return <SearchClient />;
};

export default SearchPage;
