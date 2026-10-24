"use client";

import Layout from "@components/features/MainLayout";
import AdoptionListBody from "../AdoptionListBody";

/**
 * 보호소 아이들 전체 목록(앱 src/app/adoption/shelter.tsx, 앱 docs/prd/shelter-animals.md S-2). 입양 쪽 '보호소에서 기다려요' 레일의
 * '전체 ›'가 연다. 헤더(뒤로 · 제목) 아래 입양 쪽과 같은 종 칩 줄 + 안내 한 줄 + 보호소 글 목록, 글쓰기 버튼은 없다.
 */
export default function ShelterListClient() {
  return (
    <Layout canGoBack title="보호소에서 기다려요" seoTitle="보호소에서 기다려요">
      <AdoptionListBody kind="shelter" />
    </Layout>
  );
}
