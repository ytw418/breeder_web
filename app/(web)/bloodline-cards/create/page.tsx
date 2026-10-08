import type { Metadata } from "next";
import BloodlineCardCreateClient from "./BloodlineCardCreateClient";

export const metadata: Metadata = {
  title: "혈통 만들기 | 브리디",
  description: "혈통 이름을 지키고, 분양할 때 출처 카드를 함께 보내 보세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-cards/create",
  },
};

export default function BloodlineCardCreatePage() {
  return <BloodlineCardCreateClient />;
}
