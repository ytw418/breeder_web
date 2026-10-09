"use client";

import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";

/** 프로필·마이페이지 활동 목록을 한 번에 받는 개수(앱 PROFILE_LIST_PAGE_SIZE 와 같다). */
export const PROFILE_LIST_PAGE_SIZE = 20;

export interface PagedListState<T, TPage = unknown> {
  /** 첫 페이지 응답(목록 total 같은 머리 정보). */
  firstPage?: TPage;
  /** 받은 페이지를 이어 붙이고 id 로 한 번만 남긴 목록. */
  items: T[];
  /** 첫 페이지를 받는 중. */
  isLoading: boolean;
  /** 받은 목록 없이 실패했다. 다음 페이지 실패는 받은 목록을 그대로 둔다. */
  isError: boolean;
  /** 목록을 한 번이라도 받았다. */
  isLoaded: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  /** 다음 페이지를 붙인다(실패 후 다시 시도도 이것). */
  loadMore: () => void;
  refetch: () => void;
}

/** 오프셋 페이지 사이에 새 항목이 끼면 같은 항목이 다음 페이지에 또 온다. id 로 한 번만 남긴다. */
export function uniqueById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * `?page=N&size=20` 오프셋 페이지 API(응답에 pages 총수)를 이어 붙인다. 앱 use-profile-activity-list 와 같은 규칙.
 * baseUrl 이 null 이면 요청하지 않는다.
 */
export function usePagedList<TPage extends { pages?: number }, TItem extends { id: number }>(
  baseUrl: string | null,
  pickItems: (page: TPage) => TItem[] | undefined
): PagedListState<TItem, TPage> {
  const getKey = useCallback(
    (index: number, previous: TPage | null) => {
      if (!baseUrl) return null;
      if (previous && typeof previous.pages === "number" && index >= previous.pages) return null;
      const joiner = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${joiner}page=${index + 1}&size=${PROFILE_LIST_PAGE_SIZE}`;
    },
    [baseUrl]
  );

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<TPage>(
    getKey,
    { revalidateFirstPage: false, revalidateOnFocus: false }
  );

  const items = useMemo(
    () => uniqueById((data ?? []).flatMap((page) => pickItems(page) ?? [])),
    [data, pickItems]
  );

  const lastPage = data?.[data.length - 1];
  const totalPages = typeof lastPage?.pages === "number" ? lastPage.pages : 0;
  const loadedPages = data?.length ?? 0;
  const hasNextPage = Boolean(data) && loadedPages < totalPages;
  const isFetchingNextPage = Boolean(data) && size > loadedPages && isValidating && !error;
  const isFetchNextPageError = Boolean(data) && Boolean(error);

  return {
    firstPage: data?.[0],
    items,
    isLoading: Boolean(baseUrl) && isLoading,
    isError: Boolean(error) && !data,
    isLoaded: data !== undefined,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    loadMore: () => {
      if (isFetchingNextPage) return;
      if (isFetchNextPageError) {
        void mutate();
        return;
      }
      if (hasNextPage) void setSize(loadedPages + 1);
    },
    refetch: () => {
      void mutate();
    },
  };
}
