import type { Metadata } from "next";
import BloodlineCardCreateClient from "./BloodlineCardCreateClient";

export const metadata: Metadata = {
  title: "혈통카드 만들기 | 브리디",
  description: "대표 혈통카드를 만들고 다른 유저에게 전달할 수 있습니다.",
  alternates: {
    canonical: "https://bredy.app/bloodline-cards/create",
  },
};

export default function BloodlineCardCreatePage() {
  return <BloodlineCardCreateClient />;
}
