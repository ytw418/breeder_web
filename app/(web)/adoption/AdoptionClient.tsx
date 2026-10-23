"use client";

import Layout from "@components/features/MainLayout";
import SaleTabSwitch, { SaleTabSwipeArea } from "@components/features/product/SaleTabSwitch";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import AdoptionListBody from "./AdoptionListBody";

/**
 * 분양 탭 '입양' 쪽(앱 docs/prd/pet-space.md §5.4, 시안 pet-space/B-toss.html ③ — 앱 src/app/(tabs)/products.tsx mode=adoption).
 * 강아지·고양이를 고정한 사람에게만 '분양 | 입양' 전환으로 보인다. 목록(칩·임보 레일·'가족을 기다려요')은 AdoptionListBody.
 */
export default function AdoptionClient() {
  return (
    <Layout icon hasTabBar title="분양" seoTitle="입양" showSearch>
      <CategoryScopeBar />
      <SaleTabSwitch active="adoption" />
      {/* 목록을 좌우로 밀어도 칸을 넘긴다(앱 SaleTabSwipe 와 같은 규칙). */}
      <SaleTabSwipeArea active="adoption">
        <AdoptionListBody />
      </SaleTabSwipeArea>
    </Layout>
  );
}
