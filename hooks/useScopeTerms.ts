import { useMemo } from "react";
import { useCategoryScopeState } from "@libs/client/categoryScope";
import { scopeTermsFor, type ScopeTerms } from "@libs/shared/scopeTerms";

/**
 * 관심 카테고리 범위에 맞춘 호칭('브리더'·'집사')과 경매 노출 여부(앱 hooks/useScopeTerms).
 * 고정을 바꾸면 바로 다시 그린다. 브라우저 복원 전(서버 렌더 포함)에는 고정이 없어 '브리더'·경매 보임이다.
 */
export default function useScopeTerms(): ScopeTerms {
  const { pins } = useCategoryScopeState();
  return useMemo(() => scopeTermsFor(pins), [pins]);
}
