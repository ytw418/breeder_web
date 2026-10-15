"use client";
/**
 * 홈 첫 방문 관심 카테고리 팝업(2026-10-14 사용자 결정, 앱 docs/prd/category-pin.md §15·대응표 O-1).
 * 계정·브라우저 어디에도 고른 기록이 없으면(비로그인 포함) 홈 위에 선택 시트를 띄운다. 강아지·고양이를 키우는
 * 사람이 곤충·파충류가 섞인 홈을 먼저 보지 않게 하려는 것이다. 검색·공유 링크로 상세에 바로 들어오면 막지 않는다.
 * 닫으면(배경·Escape·'건너뛰기') 전체 보기로 마친 것으로 둔다 — 아니면 홈에 올 때마다 다시 뜬다.
 */
import { BottomSheet } from "@components/app/BottomSheet";
import { markCategoryOnboardingDone, setPinnedCategories } from "@libs/client/categoryScope";
import useNeedsCategoryOnboarding from "@/hooks/useNeedsCategoryOnboarding";
import { CategoryScopeForm } from "./CategoryScopePicker";

const skip = () => {
  setPinnedCategories([]);
  markCategoryOnboardingDone();
};

export default function CategoryOnboardingPrompt() {
  const needs = useNeedsCategoryOnboarding();
  return (
    <BottomSheet open={needs === true} onClose={skip} ariaLabel="관심 분야 고르기">
      {/* 고르면 브라우저 기록이 생겨 needs 가 false 가 되고 시트가 닫힌다. */}
      <CategoryScopeForm mode="onboarding" variant="sheet" onFinish={() => undefined} />
    </BottomSheet>
  );
}
