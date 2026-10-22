import React from "react";
import type { Metadata } from "next";
import { getHomeBanners, getHomeFeed } from "@libs/server/home";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";
import LifeClient from "./LifeClient";

export const metadata: Metadata = {
  title: "반려생활",
  description: "실시간 토론, 답을 기다리는 질문, 우리 동네 브리더와 이번 주 TOP 브리더를 브리디 반려생활에서 만나 보세요.",
  alternates: { canonical: "https://bredy.app/life" },
};

/** ISR 60초(옛 홈과 같다). 새 글·분양글이 올라오면 그 API 가 홈 묶음을 다시 만든다(libs/server/pageRevalidation.ts). */
export const revalidate = 60;

const page = async () => {
  // 피드 집계가 실패해도 페이지는 그린다. 클라이언트가 다시 받아 스켈레톤·오류 상태를 보인다.
  const [initialHomeFeed, initialBanners] = await Promise.all([
    getHomeFeed({ includePersonalized: false }).catch(() => null),
    getHomeBanners(),
  ]);
  // SWR fallbackData 로 그대로 쓰이므로 클라이언트 fetcher 와 같이 탈퇴 유저 이름을 정규화한다.
  return (
    <LifeClient
      initialHomeFeed={initialHomeFeed ? normalizeDeletedUserNames(initialHomeFeed) : null}
      initialBanners={initialBanners}
    />
  );
};

export default page;
