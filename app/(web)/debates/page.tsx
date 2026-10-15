import React, { Suspense } from "react";
import type { Metadata } from "next";

import DebatesClient from "./DebatesClient";

export const metadata: Metadata = {
  title: "토론 모아보기",
  description: "브리디 브리더들의 찬반 토론 — 진행 중인 토론과 끝난 토론 결과를 모아 봐요.",
  alternates: { canonical: "https://bredy.app/debates" },
};

const page = () => (
  // ?tab=ended 를 읽어 Suspense 로 감싼다.
  <Suspense fallback={null}>
    <DebatesClient />
  </Suspense>
);

export default page;
