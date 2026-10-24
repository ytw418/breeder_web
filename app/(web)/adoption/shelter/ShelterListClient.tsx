"use client";

import AdoptionClient from "../AdoptionClient";

/**
 * 보호소 아이들 검색용 주소(/adoption/shelter, 앱 docs/prd/shelter-animals.md S-2). 2026-10-24 입양 탭 개편으로 입양 쪽 첫 서브탭
 * '보호소 아이들'이 같은 목록·필터를 보이므로, 이 주소는 그 탭을 그대로 그리는 색인용 입구다(제목·메타는 page.tsx).
 */
export default function ShelterListClient() {
  return (
    <AdoptionClient
      fixedTab="shelter"
      title="보호소에서 기다려요"
      seoTitle="보호소에서 기다려요"
      shelterHref="/adoption/shelter"
    />
  );
}
