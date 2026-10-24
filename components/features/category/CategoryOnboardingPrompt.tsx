"use client";
/**
 * 홈 첫 방문 관심 카테고리 팝업(2026-10-14 사용자 결정, 앱 docs/prd/category-pin.md §15·대응표 O-1).
 * 계정·브라우저 어디에도 고른 기록이 없으면(비로그인 포함) 홈 위에 선택 시트를 띄운다. 강아지·고양이를 키우는
 * 사람이 곤충·파충류가 섞인 홈을 먼저 보지 않게 하려는 것이다. 검색·공유 링크로 상세에 바로 들어오면 막지 않는다.
 * 닫으면(배경·Escape·'건너뛰기') 전체 보기로 두고 이번 방문(탭)엔 다시 띄우지 않는다. 고른 분야가 끝내 없으면
 * 다음 방문에 다시 묻는다(2026-10-24 사용자 결정 — 예전엔 한 번 닫으면 다시 안 떠 '처음 들어왔는데 안 뜬다'로 보였다).
 * 2026-10-23(docs/prd/pet-space.md §4): 첫 화면은 "어떤 아이를 키우시나요?" 카드(PetPickForm)이고,
 * '종까지 자세히 고르기 ›'를 누르면 지금 트리 폼으로 바꾼다. 고르면 홈에 그대로 있다(입양 쪽으로 보내지 않는다).
 */
import { useState } from "react";
import { BottomSheet } from "@components/app/BottomSheet";
import { PetPickForm } from "@components/features/pet/PetPickForm";
import { markCategoryOnboardingDone, setPinnedCategories } from "@libs/client/categoryScope";
import useNeedsCategoryOnboarding, { markCategoryPromptDismissed } from "@/hooks/useNeedsCategoryOnboarding";
import { CategoryScopeForm } from "./CategoryScopePicker";

const skip = () => {
  markCategoryPromptDismissed();
  setPinnedCategories([]);
  markCategoryOnboardingDone();
};

export default function CategoryOnboardingPrompt() {
  const needs = useNeedsCategoryOnboarding();
  const [detail, setDetail] = useState(false);
  // 트리 폼에서 '전체 보기'로 마치면 고정이 0개라 needs 가 그대로 true 다 — 이번 방문엔 닫힌 것으로 둔다.
  const [closed, setClosed] = useState(false);
  const finish = () => {
    markCategoryPromptDismissed();
    setClosed(true);
  };
  const close = () => {
    skip();
    setClosed(true);
  };
  return (
    <BottomSheet open={needs === true && !closed} onClose={close} ariaLabel="키우는 아이 고르기">
      {/* 고르면 브라우저 기록이 생겨 needs 가 false 가 되고 시트가 닫힌다. */}
      {detail ? (
        <CategoryScopeForm mode="onboarding" variant="sheet" onFinish={finish} />
      ) : (
        <PetPickForm variant="sheet" onFinish={finish} onDetail={() => setDetail(true)} />
      )}
    </BottomSheet>
  );
}
