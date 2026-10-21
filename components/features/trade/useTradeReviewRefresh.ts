"use client";

import { useSWRConfig } from "swr";

/**
 * 거래 후기 쓰기·답글·숨김 뒤 다시 받을 화면 값: 분양 상세(후기 블록·하단 바), 프로필('후기 N'), 받은 후기 목록,
 * 분양·입양내역('거래 후기 쓰기' pill). 모두 /api/products/* · /api/users/* 아래다(useSWRInfinite 키는 $inf$ 접두).
 */
export function useTradeReviewRefresh() {
  const { mutate } = useSWRConfig();
  return () =>
    mutate((key) => typeof key === "string" && /^(\$inf\$)?\/api\/(products|users)\//.test(key));
}
