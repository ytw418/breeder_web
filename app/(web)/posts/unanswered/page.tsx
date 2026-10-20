import type { Metadata } from "next";
import UnansweredClient from "./UnansweredClient";

export const metadata: Metadata = {
  title: "답 기다리는 질문",
  description: "브리디에서 아직 답이 없는 질문을 모아봤어요.",
  robots: { index: false, follow: true },
};

export default function UnansweredPostsPage() {
  return <UnansweredClient />;
}
