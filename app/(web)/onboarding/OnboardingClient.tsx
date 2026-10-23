"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import CategoryScopePicker from "@components/features/category/CategoryScopePicker";
import { PetPickForm } from "@components/features/pet/PetPickForm";
import { getSafeNextPath } from "@libs/client/postLogin";

/**
 * 첫 로그인 직후 온보딩(docs/prd/pet-space.md §4). 맨 앞은 "어떤 아이를 키우시나요?" 카드이고,
 * '종까지 자세히 고르기 ›'면 지금 트리 화면(CategoryScopePicker)으로 바꾼다. 마치면 next(없으면 홈)로 간다.
 */
export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState(false);
  if (detail) return <CategoryScopePicker mode="onboarding" />;
  return (
    <Layout headerVariant="none" seoTitle="키우는 아이 고르기">
      <PetPickForm
        onFinish={() => router.replace(getSafeNextPath(searchParams?.get("next")))}
        onDetail={() => setDetail(true)}
      />
    </Layout>
  );
}
