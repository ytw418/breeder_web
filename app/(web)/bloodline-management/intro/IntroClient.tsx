"use client";
/**
 * 혈통 안내 다시 보기 — S1 소개(CTA 포함). 혈통 목록(S2) 맨 아래 "혈통 안내 다시 보기"에서 온다.
 * 비로그인이 열면 CTA 가 로그인 → 만들기로 보낸다(앱 intro.tsx).
 */
import Layout, { toLoginHref } from "@components/features/MainLayout";
import BloodlineIntro from "@components/features/bloodline/BloodlineIntro";
import { BloodlineHeader } from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";

export default function IntroClient() {
  const { user, isLoading } = useUser();
  const createHref = !user && !isLoading ? toLoginHref("/bloodline-cards/create") : "/bloodline-cards/create";
  return (
    <Layout headerVariant="none" seoTitle="혈통 안내">
      <BloodlineHeader title="혈통" />
      <BloodlineIntro createHref={createHref} />
    </Layout>
  );
}
