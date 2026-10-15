import useUser from "hooks/useUser";
import { useCategoryScopeState } from "@libs/client/categoryScope";
import { needsCategoryOnboarding } from "@libs/client/postLogin";

/**
 * 관심 카테고리를 한 번도 고른 적 없는지(계정·브라우저 둘 다 기록 없음). 비로그인은 브라우저 기록만 본다.
 * 브라우저 복원이나 로그인 확인이 끝나기 전엔 null 이다.
 */
export default function useNeedsCategoryOnboarding(): boolean | null {
  const { pins, onboarded, hydrated } = useCategoryScopeState();
  const { user, isLoading } = useUser();
  if (!hydrated || isLoading) return null;
  return needsCategoryOnboarding({
    serverPinnedIds: user?.pinnedCategoryIds,
    serverOnboarded: Boolean(user?.categoryOnboardedAt),
    localPinCount: pins.length,
    onboarded,
  });
}
