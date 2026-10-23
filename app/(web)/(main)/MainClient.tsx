"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import FloatingButton, { FAB_LIST_BOTTOM_PADDING_CLASS } from "@components/atoms/floating-button";
import { ActionSheet } from "@components/app/ActionSheet";
import { ASK_QUESTION_HREF } from "@components/features/post/AwaitingAnswerCard";
import { cn } from "@libs/client/utils";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import useUser from "hooks/useUser";
import useSectionImpressions from "hooks/useSectionImpressions";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import CategoryOnboardingPrompt from "@components/features/category/CategoryOnboardingPrompt";
import HomeComposer from "@components/features/home/HomeComposer";
import HotTop10Rail from "@components/features/home/HotTop10Rail";
import HomePostsFeed from "./HomePostsFeed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * home_section_view 의 section_id 와 position(화면 위에서부터 순서). 요소에는 data-home-section 으로 붙인다.
 * 2026-10-22 홈 v2(앱 docs/prd/home-v2.md S-1): 인기글 TOP 10 → 쓰레드식 피드. 토론·동네·랭킹·미션·배너는 반려생활 탭(/life).
 */
const HOME_SECTION_ORDER = ["composer", "hot_top10", "posts_feed"] as const;
type HomeSectionId = (typeof HOME_SECTION_ORDER)[number];

/**
 * 홈(앱 src/app/(tabs)/index.tsx, 시안 design/mockups/home-photo-question/C-threads.html ①②).
 * 관심 분야 바 → 새 소식 입력줄 → 인기글 TOP 10(이번 주) → 8 갭 → 칩(sticky) + 쓰레드식 피드(게시글 3개마다 분양글 하나).
 * 글쓰기 FAB 는 새 소식 입력줄이 보이는 동안 숨고, 스크롤해 입력줄이 사라지면 나타난다(사용자 2026-10-22).
 */
const MainClient = () => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [showPostLoginGuide, setShowPostLoginGuide] = useState(false);
  // 글쓰기 FAB 시트: 글쓰기 · 질문하기 · 토론 열기(2026-10-21 감사 #1 — 질문을 올리는 입구).
  const [writeSheetOpen, setWriteSheetOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const homeRootRef = useRef<HTMLDivElement>(null);
  // 새 소식 입력줄이 보이는지. 처음엔 맨 위라 보인다고 두어 FAB 가 잠깐 비치지 않게 한다.
  const [composerVisible, setComposerVisible] = useState(true);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    try {
      const shouldShow = localStorage.getItem("bredy:show-post-login-guide");
      if (shouldShow === "1") {
        setShowPostLoginGuide(true);
        localStorage.removeItem("bredy:show-post-login-guide");
      }
    } catch {
      // noop
    }
  }, [isUserLoading, user]);

  // 섹션이 화면에 절반 이상 보였을 때 섹션마다 한 번 기록한다(홈 진입 때 한꺼번에 찍으면 노출량을 비교할 수 없다).
  useSectionImpressions(homeRootRef, (sectionId) => {
    const position = HOME_SECTION_ORDER.indexOf(sectionId as HomeSectionId) + 1;
    trackEvent(ANALYTICS_EVENTS.homeSectionView, {
      section_id: sectionId,
      position: position > 0 ? position : null,
      user_tier: user ? "member" : "guest",
    });
  });

  const handleInstallClick = async () => {
    if (!deferredInstallPrompt) {
      alert("현재 브라우저에서는 자동 설치 프롬프트를 사용할 수 없습니다.");
      return;
    }

    try {
      trackEvent(ANALYTICS_EVENTS.homePostLoginInstallClicked, {
        user_id: user?.id || null,
      });
      setInstallLoading(true);
      await deferredInstallPrompt.prompt();
      const userChoice = await deferredInstallPrompt.userChoice;
      trackEvent(ANALYTICS_EVENTS.homePostLoginInstallCompleted, {
        user_id: user?.id || null,
        install_outcome: userChoice?.outcome || "unknown",
        platform: userChoice?.platform || "unknown",
      });
      setDeferredInstallPrompt(null);
      setShowPostLoginGuide(false);
    } finally {
      setInstallLoading(false);
    }
  };

  const handleGoPushSettings = () => {
    trackEvent(ANALYTICS_EVENTS.homePostLoginPushSettingsClicked, {
      user_id: user?.id || null,
    });
    setShowPostLoginGuide(false);
    router.push("/settings");
  };

  return (
    <div ref={homeRootRef} className={`flex h-full flex-col bg-app-bg ${FAB_LIST_BOTTOM_PADDING_CLASS}`}>
      {/* 현재 관심 분야(고정 범위). 온보딩을 마치면 숨는다. 칩이 헤더 바로 아래 붙도록 이 줄은 고정하지 않는다. */}
      <CategoryScopeBar />
      {/* 관심 분야를 고른 기록이 계정·브라우저 어디에도 없으면 홈 위에 선택 시트를 띄운다(비로그인 포함). */}
      <CategoryOnboardingPrompt />

      {/* 1. 새 소식 입력줄(내 사진 + 입력칸 + 사진 · 사진 자랑 · 질문하기 · 토론 열기) */}
      <HomeComposer onVisibleChange={setComposerVisible} />

      {/* 2. 인기글 TOP 10(이번 주). 0개면 섹션이 없다. */}
      <HotTop10Rail />
      <div className="h-2 shrink-0 bg-app-gap" aria-hidden="true" />

      {/* 3. 칩 + 쓰레드식 피드. ?category= 를 읽어 useSearchParams 를 쓰므로 Suspense 로 감싼다. */}
      <Suspense fallback={null}>
        <HomePostsFeed />
      </Suspense>

      <FloatingButton onClick={() => setWriteSheetOpen(true)} label="글쓰기" hidden={composerVisible}>
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </FloatingButton>
      <ActionSheet
        open={writeSheetOpen}
        onClose={() => setWriteSheetOpen(false)}
        actions={[
          { key: "post", label: "글쓰기", onSelect: () => router.push("/posts/upload") },
          { key: "question", label: "질문하기", onSelect: () => router.push(ASK_QUESTION_HREF) },
          { key: "debate", label: "토론 열기", onSelect: () => router.push("/posts/debate") },
        ]}
      />

      {showPostLoginGuide && (
        <div className="fixed inset-0 z-50 bg-app-overlay px-4 py-8">
          <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl border border-app-border bg-app-elevated p-5">
            <h3 className="text-base font-semibold text-app-text">시작 설정</h3>
            <p className="mt-1 text-sm text-app-sub">
              홈 화면 설치와 푸시 알림을 설정하면 새 소식을 빠르게 확인할 수 있습니다.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className={cn(
                  "h-11 rounded-md text-sm font-semibold transition-colors",
                  deferredInstallPrompt
                    ? "bg-app-brand text-white"
                    : "bg-app-surface text-app-muted"
                )}
                disabled={!deferredInstallPrompt || installLoading}
              >
                {installLoading ? "설치 준비 중..." : "홈 화면에 설치하기"}
              </button>
              <button
                type="button"
                onClick={handleGoPushSettings}
                className="h-11 rounded-md bg-app-surface text-sm font-semibold text-app-text"
              >
                푸시 알림 설정하기
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent(ANALYTICS_EVENTS.homePostLoginGuideDismissed, {
                    user_id: user?.id || null,
                  });
                  setShowPostLoginGuide(false);
                }}
                className="h-10 rounded-md text-sm font-medium text-app-muted"
              >
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainClient;
