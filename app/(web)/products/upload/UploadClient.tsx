"use client";

import { useSearchParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { ProductForm } from "../_components/ProductForm";

/** 상품 등록(앱 src/app/products/upload.tsx). ?free=1 이면 무료나눔을 미리 고른다. */
const UploadClient = () => {
  const searchParams = useSearchParams();
  const initialFree = searchParams?.get("free") === "1";
  return (
    <Layout canGoBack title="분양 등록" headerRight={<></>}>
      <ProductForm initialFree={initialFree} />
    </Layout>
  );
};

export default UploadClient;
