"use client";

import { useSearchParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { ProductForm } from "../_components/ProductForm";

/**
 * 상품 등록(앱 src/app/products/upload.tsx). ?free=1 이면 무료 분양, ?category=<종> 이면 카테고리를 미리 고른다.
 * ?kind=rehoming|foster 는 입양 쪽 글쓰기(docs/prd/pet-space.md §5.4) — 글 종류를 미리 고른다.
 */
const UploadClient = () => {
  const searchParams = useSearchParams();
  const initialFree = searchParams?.get("free") === "1";
  const initialCategory = searchParams?.get("category") ?? undefined;
  const initialKind = searchParams?.get("kind") ?? undefined;
  return (
    <Layout canGoBack title="분양 등록" headerRight={<></>}>
      <ProductForm initialFree={initialFree} initialCategory={initialCategory} initialKind={initialKind} />
    </Layout>
  );
};

export default UploadClient;
