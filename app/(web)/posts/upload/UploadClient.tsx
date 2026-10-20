"use client";

import { useSearchParams } from "next/navigation";
import { PostComposer } from "../_components/PostComposer";

/**
 * 글쓰기(앱 posts/upload). 폼은 수정 화면과 공용인 PostComposer 가 그린다. 로그인은 page 의 AuthGuard 가 확인한다.
 * `?category=동네` 처럼 주제를 미리 고른 채로 열 수 있다(반려생활 '동네' 빈 상태의 '인사 남기기').
 * `?species=크레스티드 게코` 는 종을 미리 고른다(사육 가이드 '물어보기').
 */
const UploadClient = () => {
  const searchParams = useSearchParams();
  const category = searchParams?.get("category") ?? undefined;
  const species = searchParams?.get("species") ?? undefined;
  return <PostComposer mode="create" defaultCategory={category} defaultSpecies={species} />;
};

export default UploadClient;
