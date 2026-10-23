import type { Metadata } from "next";
import AdoptionClient from "./AdoptionClient";

export const metadata: Metadata = {
  title: "입양 · 임보",
  description:
    "브리디에서 새 가족을 기다리는 강아지·고양이와 잠시 맡아 줄 임보처를 찾는 글을 모아 보세요.",
  alternates: { canonical: "https://bredy.app/adoption" },
  openGraph: {
    title: "입양 · 임보 | 브리디",
    description: "새 가족을 기다리는 강아지·고양이와 임보 구하는 글을 모아 보세요.",
    url: "https://bredy.app/adoption",
    siteName: "Bredy",
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** 분양 탭 '입양' 쪽(docs/prd/pet-space.md §5.4). 칩(?chip=)은 클라이언트가 읽는다. 쿼리를 받아 동적 렌더로 둔다(분양 목록과 같다). */
export default async function AdoptionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await searchParams;
  return <AdoptionClient />;
}
