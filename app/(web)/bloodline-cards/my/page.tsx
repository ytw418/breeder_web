import type { Metadata } from "next";
import MyBloodlineClient from "./MyBloodlineClient";

export const metadata: Metadata = {
  title: "내 혈통 상세 | 브리디",
  description: "내 대표 혈통카드 상세 정보를 확인합니다.",
};

export default function MyBloodlinePage() {
  return <MyBloodlineClient />;
}
