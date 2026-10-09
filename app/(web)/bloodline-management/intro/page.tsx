import type { Metadata } from "next";
import IntroClient from "./IntroClient";

export const metadata: Metadata = {
  title: "혈통 안내 | 브리디",
  description: "내 혈통 이름을 지키고, 분양할 때 출처 카드를 함께 넘기는 방법을 안내합니다.",
};

/** 혈통 안내 다시 보기(앱 bloodline-management/intro.tsx) — S1 소개를 그대로 다시 보여 준다. */
export default function BloodlineIntroPage() {
  return <IntroClient />;
}
