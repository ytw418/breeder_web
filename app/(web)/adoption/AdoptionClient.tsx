"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import Layout from "@components/features/MainLayout";
import SaleTabSwitch, { SaleTabSwipeArea } from "@components/features/product/SaleTabSwitch";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import ShelterTab, { useShelterTotal } from "@components/features/pet/ShelterTab";
import { cn } from "@libs/client/utils";
import { fosterListHref, isAdoptionChip } from "@libs/shared/petSpace";
import AdoptionListBody from "./AdoptionListBody";

type AdoptionSubTab = "shelter" | "family";

/**
 * 입양 쪽 서브탭 '보호소 아이들 2,400 | 가족 찾아요·임보'(앱 design/mockups/adoption-v2/A-karrot.html .sub).
 * 높이 44, 왼쪽 정렬 글자 탭, 선택 15/700 + 2px 밑줄, 비선택 15/500 muted, 숫자 13/500 muted. 고른 종 칩(?chip=)은 들고 간다.
 */
function AdoptionSubTabs({ active, shelterHref }: { active: AdoptionSubTab; shelterHref: string }) {
  const total = useShelterTotal();
  const chip = useSearchParams()?.get("chip");
  const familyParams = new URLSearchParams({ tab: "family" });
  if (isAdoptionChip(chip) && chip !== "all") familyParams.set("chip", chip);
  const shelterWithChip =
    isAdoptionChip(chip) && chip !== "all"
      ? `${shelterHref}${shelterHref.includes("?") ? "&" : "?"}chip=${chip}`
      : shelterHref;
  const tabs: Array<{ id: AdoptionSubTab; label: string; href: string }> = [
    { id: "shelter", label: "보호소 아이들", href: shelterWithChip },
    { id: "family", label: "가족 찾아요·임보", href: `/adoption?${familyParams.toString()}` },
  ];
  return (
    <nav aria-label="입양 목록" className="flex h-11 gap-5 border-b border-app-line bg-app-bg px-4">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            replace
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-1 text-[15px] leading-[22px]",
              selected ? "font-bold text-app-text" : "font-medium text-app-muted"
            )}
          >
            {tab.label}
            {tab.id === "shelter" && total !== undefined ? (
              <em className="text-[13px] font-medium not-italic text-app-muted">{total.toLocaleString("ko-KR")}</em>
            ) : null}
            {selected ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-app-text" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 분양 탭 '입양' 쪽(앱 docs/prd/pet-space.md §5.4, 앱 design/mockups/adoption-v2/A-karrot.html — 앱 src/app/(tabs)/products.tsx mode=adoption).
 * 맨 위 전환은 '입양 | 분양'(입양이 왼쪽·강아지·고양이만 고정하면 처음 열리는 칸). 그 아래 서브탭 '보호소 아이들'(기본, ?tab=shelter)과
 * '가족 찾아요·임보'(?tab=family: 임보 레일 + 가족을 기다려요 목록 + 글쓰기 버튼). 보호소 필터는 주소 쿼리에 적는다.
 * fixedTab 은 검색용 /adoption/shelter 가 쓴다 — 같은 보호소 탭을 그대로 보인다.
 */
export default function AdoptionClient({
  fixedTab,
  title = "분양",
  seoTitle = "입양",
  shelterHref = "/adoption?tab=shelter",
}: {
  fixedTab?: "shelter";
  title?: string;
  seoTitle?: string;
  shelterHref?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: AdoptionSubTab = fixedTab ?? (searchParams?.get("tab") === "family" ? "family" : "shelter");
  const oldFosterLink = searchParams?.get("chip") === "foster";

  // 글 종류 칩이 있던 때의 공유 링크(?chip=foster)는 임보 구해요 전체 목록으로 보낸다.
  useEffect(() => {
    if (oldFosterLink) router.replace(fosterListHref("all"));
  }, [oldFosterLink, router]);

  return (
    <Layout icon hasTabBar title={title} seoTitle={seoTitle} showSearch>
      <CategoryScopeBar />
      <SaleTabSwitch active="adoption" />
      {/* 목록을 좌우로 밀어도 칸을 넘긴다(앱 SaleTabSwipe 와 같은 규칙). */}
      <SaleTabSwipeArea active="adoption">
        <AdoptionSubTabs active={tab} shelterHref={shelterHref} />
        {tab === "shelter" ? <ShelterTab /> : <AdoptionListBody />}
      </SaleTabSwipeArea>
    </Layout>
  );
}
