"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { isPetPostKind, productWriteLabels } from "@libs/shared/petSpace";
import { ProductForm } from "../_components/ProductForm";

/**
 * 상품 등록(앱 src/app/products/upload.tsx). ?free=1 이면 무료 분양, ?category=<종> 이면 카테고리를 미리 고른다.
 * ?kind=rehoming|foster 는 입양 쪽 글쓰기(docs/prd/pet-space.md §5.4) — 글 종류를 미리 고른다.
 * 헤더 제목은 폼이 정한다(임보·가족 찾기 글이면 '글쓰기', productWriteLabels).
 */
const UploadClient = () => {
  const searchParams = useSearchParams();
  const initialFree = searchParams?.get("free") === "1";
  const initialCategory = searchParams?.get("category") ?? undefined;
  const initialKind = searchParams?.get("kind") ?? undefined;
  // 첫 그림부터 맞는 제목을 둔다(폼이 그린 뒤 바뀌며 깜빡이지 않게).
  const [title, setTitle] = useState(() => productWriteLabels(isPetPostKind(initialKind) ? initialKind : null).title);
  return (
    <Layout canGoBack title={title} headerRight={<></>}>
      <ProductForm
        initialFree={initialFree}
        initialCategory={initialCategory}
        initialKind={initialKind}
        onTitleChange={setTitle}
      />
    </Layout>
  );
};

export default UploadClient;
