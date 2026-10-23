"use client";

import Layout from "@components/features/MainLayout";
import AdoptionListBody from "../AdoptionListBody";

/**
 * 임보 구해요 전체 목록(앱 src/app/adoption/foster.tsx, 앱 docs/prd/pet-space.md §5.4). 입양 쪽 '임보해 주실 분 찾아요' 레일의
 * '전체 ›'가 연다. 입양 쪽 칩에서 글 종류(임보 구해요·가족 찾아요)를 빼면서 그 칩이 하던 일을 따로 화면으로 옮겼다(토스 리뷰 시안 ④).
 * 헤더(뒤로 · 제목) 아래 입양 쪽과 같은 종 칩 줄 + 임보 구해요 글 목록, 글쓰기 버튼은 임보 구하는 글.
 */
export default function FosterListClient() {
  return (
    <Layout canGoBack title="임보해 주실 분 찾아요" seoTitle="임보해 주실 분 찾아요">
      <AdoptionListBody kind="foster" />
    </Layout>
  );
}
