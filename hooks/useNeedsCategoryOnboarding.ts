import useUser from "hooks/useUser";
import { useCategoryScopeState } from "@libs/client/categoryScope";
import { needsHomeCategoryPrompt } from "@libs/client/postLogin";

const DISMISSED_KEY = "bredy:categoryScope:promptDismissed";

/** 홈 팝업을 이번 방문(탭)에서 닫았다고 적는다. 다음 방문엔 고른 분야가 없으면 다시 묻는다. */
export function markCategoryPromptDismissed() {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // 시크릿 모드 등 저장소를 못 쓰면 무시한다.
  }
}

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 홈 첫 방문 관심 분야 팝업을 띄울지. 고른 분야(고정)가 계정·브라우저 둘 다 없으면 true 다. 비로그인은 브라우저만 본다.
 * 브라우저 복원이나 로그인 확인이 끝나기 전엔 null 이다.
 */
export default function useNeedsCategoryOnboarding(): boolean | null {
  const { pins, hydrated } = useCategoryScopeState();
  const { user, isLoading } = useUser();
  if (!hydrated || isLoading) return null;
  return needsHomeCategoryPrompt({
    serverPinnedIds: user?.pinnedCategoryIds,
    localPinCount: pins.length,
    dismissedThisVisit: readDismissed(),
  });
}
