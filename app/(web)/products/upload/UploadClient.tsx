"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { useCategoryScopeState } from "@libs/client/categoryScope";
import { isPetPostKind, petWriteDefaults, productWriteLabels } from "@libs/shared/petSpace";
import { ProductForm } from "../_components/ProductForm";

/**
 * 상품 등록(앱 src/app/products/upload.tsx). ?free=1 이면 무료 분양, ?category=<종> 이면 카테고리를 미리 고른다.
 * ?kind=rehoming|foster 는 입양 쪽 글쓰기(docs/prd/pet-space.md §5.4) — 글 종류를 미리 고른다.
 * 링크가 정하지 않았고 강아지·고양이만 고정했으면 '분양해요'·고정한 종으로 연다(petWriteDefaults, 코덱스 디자인 리뷰 결정 A).
 * 헤더 제목은 폼이 정한다(임보·가족 찾기 글이면 '글쓰기', productWriteLabels).
 */
const UploadClient = () => {
  const searchParams = useSearchParams();
  const initialFree = searchParams?.get("free") === "1";
  const categoryParam = searchParams?.get("category") ?? undefined;
  const kindParam = searchParams?.get("kind") ?? undefined;
  const scope = useCategoryScopeState();
  // 고정 범위는 브라우저 복원(hydrated) 뒤에 읽힌다. 그때 기본값이 생기면 폼을 한 번 새로 연다(key) — 손대기 전이다.
  const petDefaults =
    !initialFree && !categoryParam && !isPetPostKind(kindParam) && scope.hydrated
      ? petWriteDefaults(scope.pins.map((pin) => pin.path))
      : null;
  const initialKind = petDefaults?.kind ?? kindParam;
  const initialCategory = categoryParam ?? petDefaults?.category ?? undefined;
  // 첫 그림부터 맞는 제목을 둔다(폼이 그린 뒤 바뀌며 깜빡이지 않게).
  const [title, setTitle] = useState(() => productWriteLabels(isPetPostKind(kindParam) ? kindParam : null).title);
  return (
    <Layout canGoBack title={title} headerRight={<></>}>
      <ProductForm
        key={petDefaults ? "pet" : "plain"}
        initialFree={initialFree}
        initialCategory={initialCategory}
        initialKind={initialKind}
        onTitleChange={setTitle}
      />
    </Layout>
  );
};

export default UploadClient;
