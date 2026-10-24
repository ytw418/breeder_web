import type { Metadata } from "next";
import ShelterListClient from "./ShelterListClient";

const TITLE = "유기견·유기묘 입양 — 보호소에서 기다려요 | 강아지 무료분양·무료입양 - 브리디";
const DESCRIPTION =
  "유기견 보호소와 유기묘 보호소에서 주인 찾아요, 강아지 키워주세요 하는 아이들을 모았어요. 국가동물보호정보시스템 공고를 3시간마다 옮겨 오고, 강아지·고양이 무료분양·무료입양 문의는 보호소로 하면 돼요. 유기견 입양은 브리디에서 먼저 만나 보세요.";

export const metadata: Metadata = {
  // 완성 제목이라 레이아웃 제목 템플릿(' | 브리디')을 붙이지 않는다.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "유기견 보호소",
    "유기견 입양",
    "유기묘 입양",
    "강아지 키워주세요",
    "주인 찾아요",
    "강아지 무료분양",
    "고양이 무료분양",
    "무료입양",
    "브리디",
  ],
  alternates: { canonical: "https://bredy.app/adoption/shelter" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://bredy.app/adoption/shelter",
    siteName: "Bredy",
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * 보호소 아이들 전체 목록(앱 src/app/adoption/shelter.tsx, 앱 docs/prd/shelter-animals.md S-2). 칩(?chip=)은 클라이언트가 읽는다.
 * 2026-10-24 사용자 결정: 색인한다 — 제목·설명·keywords 에 유기견 보호소·유기견 입양·강아지 키워주세요·주인 찾아요를 넣는다.
 */
export default async function ShelterListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await searchParams;
  return <ShelterListClient />;
}
