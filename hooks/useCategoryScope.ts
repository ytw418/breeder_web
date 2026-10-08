"use client";
import { useMemo } from "react";
import useSWR from "swr";
import {
  formatScopeLabel,
  toCategoryPath,
  useCategoryScopeState,
  type PinnedCategory,
} from "@libs/client/categoryScope";
import type { CategoriesResponse, CategoryItem } from "@libs/shared/categories";

export const CATEGORIES_KEY = "/api/categories";

export interface CategoryScope {
  pins: PinnedCategory[];
  /** 목록 API 에 보내는 범위(path 쉼표 목록). 전체 보기면 undefined. SWR 키에도 넣는다. */
  categoryPath: string | undefined;
  /** "전체 보기" / "포유류 > 햄스터" / "파충류 외 1" */
  label: string;
  /** 범위에 드는 최상위 카테고리 이름(홈 칩·종 드롭다운을 줄일 때). 전체 보기면 null. */
  topLevelNames: Set<string> | null;
  categories: CategoryItem[];
  /** localStorage 복원이 끝났는지. 끝나기 전엔 범위 없는 요청을 보내지 않으려는 화면이 본다. */
  hydrated: boolean;
}

/** 화면에서 쓰는 범위 훅(앱 hooks/useCategoryScope.ts). */
export default function useCategoryScope(): CategoryScope {
  const { pins, hydrated } = useCategoryScopeState();
  const { data } = useSWR<CategoriesResponse>(CATEGORIES_KEY, { revalidateOnFocus: false });
  const categories = data?.categories;
  return useMemo(() => {
    const list = categories ?? [];
    const topLevelNames = pins.length
      ? new Set(
          pins.map((pin) => {
            const rootSlug = pin.path.split("/").filter(Boolean)[0];
            return (
              list.find((c) => c.parentId == null && c.slug === rootSlug)?.name ??
              pin.label.split(" > ")[0]
            );
          })
        )
      : null;
    return {
      pins,
      categoryPath: toCategoryPath(pins),
      label: formatScopeLabel(pins),
      topLevelNames,
      categories: list,
      hydrated,
    };
  }, [pins, categories, hydrated]);
}

/** 이름 목록(홈 칩·종 옵션)을 범위 안 최상위 카테고리로 줄인다. 전체 보기면 그대로. */
export function withinScope<T>(
  items: readonly T[],
  topLevelNames: Set<string> | null,
  nameOf: (item: T) => string,
  keep: (item: T) => boolean = () => false
): T[] {
  if (!topLevelNames) return [...items];
  return items.filter((item) => keep(item) || topLevelNames.has(nameOf(item)));
}

/** URL 에 categoryPath 쿼리를 붙인다(범위가 없으면 그대로). SWR 키가 범위마다 갈린다. */
export function withCategoryPath(url: string, categoryPath: string | undefined) {
  if (!categoryPath) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}categoryPath=${encodeURIComponent(categoryPath)}`;
}
