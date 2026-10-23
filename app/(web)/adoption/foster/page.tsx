import type { Metadata } from "next";
import FosterListClient from "./FosterListClient";

export const metadata: Metadata = {
  title: "임보해 주실 분 찾아요",
  description: "브리디에서 잠시 맡아 줄 임보처(임시보호)를 찾는 강아지·고양이 글을 모아 보세요.",
  alternates: { canonical: "https://bredy.app/adoption/foster" },
  openGraph: {
    title: "임보해 주실 분 찾아요 | 브리디",
    description: "잠시 맡아 줄 임보처를 찾는 강아지·고양이 글을 모아 보세요.",
    url: "https://bredy.app/adoption/foster",
    siteName: "Bredy",
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** 임보 구해요 전체 목록(앱 src/app/adoption/foster.tsx, 앱 docs/prd/pet-space.md §5.4). 칩(?chip=)은 클라이언트가 읽는다. */
export default async function FosterListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await searchParams;
  return <FosterListClient />;
}
