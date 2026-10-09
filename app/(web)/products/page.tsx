import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";

export const metadata: Metadata = {
  title: "분양 목록 | 브리디",
  description:
    "브리디에 올라온 곤충·파충류·어류 등 반려생물과 용품을 카테고리·가격·분양 상태로 골라 보세요.",
  alternates: { canonical: "https://bredy.app/products" },
  openGraph: {
    title: "분양 목록 | 브리디",
    description: "브리디에 올라온 반려생물과 용품을 한눈에 확인하세요.",
    url: "https://bredy.app/products",
    siteName: "Bredy",
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** 쿼리(category·status·price·minPrice·maxPrice·sort·productType)를 필터로 읽는다. 이후 필터 변경은 클라이언트가 URL 에 다시 적는다. */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <ProductsClient initialParams={params} />;
}
