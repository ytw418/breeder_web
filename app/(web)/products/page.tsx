import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";

export const metadata: Metadata = {
  title: "상품 목록 | 브리디",
  description:
    "브리디에 올라온 곤충·파충류·어류 등 반려생물과 용품을 카테고리·가격·판매 상태로 골라 보세요.",
  alternates: { canonical: "https://bredy.app/products" },
  openGraph: {
    title: "상품 목록 | 브리디",
    description: "브리디에 올라온 반려생물과 용품을 한눈에 확인하세요.",
    url: "https://bredy.app/products",
    siteName: "Bredy",
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** 쿼리(category·status·price·minPrice·maxPrice·sort·productType)는 처음 한 번만 필터로 읽는다. */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <ProductsClient initialParams={params} />;
}
