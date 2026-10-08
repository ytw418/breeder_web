"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { BottomSheet } from "@components/app/BottomSheet";
import type { CategoriesResponse, CategoryItem } from "@libs/shared/categories";

/**
 * 게시글 '관심 생물군' 시트(앱 SpeciesPickerSheet 를 게시글에 쓰는 모양과 같다).
 * - 선택지는 서버 Category 트리(`/api/categories`). 강아지·고양이 같은 소분류까지 고를 수 있다.
 * - 상위 칩 한 줄 → 고른 상위의 목록: '선택 안 함' · "포유류 전체" · 하위. 하위가 없는 상위(기타)는 칩을 누르면 바로 고른다.
 * - 관심 카테고리(계정 pinnedCategoryIds)가 있으면 맨 앞 '관심' 칩에 모아 보여 주고, 값이 없을 때 그 칩부터 연다.
 * - 값은 카테고리 name 이고 서버 species(Post.type)로 그대로 보낸다(docs/prd/category-pin.md §12).
 */

const SUGGESTED_TAB_ID = -1;

type SpeciesRow = { name: string; label: string; depth: number };

const bySortOrder = (a: CategoryItem, b: CategoryItem) => a.sortOrder - b.sortOrder || a.id - b.id;

function buildTree(categories: readonly CategoryItem[]) {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const tops: CategoryItem[] = [];
  const childrenOf = new Map<number, CategoryItem[]>();
  for (const item of categories) {
    if (item.parentId == null || !byId.has(item.parentId)) {
      tops.push(item);
      continue;
    }
    const list = childrenOf.get(item.parentId) ?? [];
    list.push(item);
    childrenOf.set(item.parentId, list);
  }
  tops.sort(bySortOrder);
  childrenOf.forEach((list) => list.sort(bySortOrder));
  return { tops, childrenOf, byId };
}

type SpeciesTree = ReturnType<typeof buildTree>;

function descendantsOf(tree: SpeciesTree, topId: number) {
  const out: { item: CategoryItem; depth: number }[] = [];
  const walk = (parentId: number, depth: number) => {
    for (const child of tree.childrenOf.get(parentId) ?? []) {
      out.push({ item: child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(topId, 1);
  return out;
}

/** "포유류 > 햄스터" 처럼 조상 이름을 이은 라벨. */
function labelOf(tree: SpeciesTree, item: CategoryItem) {
  const names: string[] = [];
  let current: CategoryItem | undefined = item;
  while (current) {
    names.unshift(current.name);
    current = current.parentId == null ? undefined : tree.byId.get(current.parentId);
  }
  return names.join(" > ");
}

function topIdOfName(tree: SpeciesTree, name: string) {
  if (!name) return null;
  let current = Array.from(tree.byId.values()).find((item) => item.name === name);
  while (current && current.parentId != null && tree.byId.has(current.parentId)) {
    current = tree.byId.get(current.parentId);
  }
  return current?.id ?? null;
}

/** 관심 카테고리가 하나뿐이면 그 이름(새 글 기본값). 아니면 "". */
export function defaultSpeciesFromPins(
  categories: readonly CategoryItem[] | undefined,
  pinnedIds: readonly number[] | undefined
) {
  if (!categories || pinnedIds?.length !== 1) return "";
  return categories.find((item) => item.id === pinnedIds[0])?.name ?? "";
}

export function SpeciesPickerSheet({
  open,
  title,
  value,
  suggestedIds,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  /** 지금 고른 종(Category name). 없으면 "". */
  value: string;
  /** 맨 앞 '관심' 칩에 보일 카테고리 id. 비면 칩을 두지 않는다. */
  suggestedIds?: readonly number[];
  /** 종을 고르면 Category name 을 준다('선택 안 함'은 ""). 시트를 닫는 것은 부모가 한다. */
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const { data, error, mutate } = useSWR<CategoriesResponse>("/api/categories");
  const categories = data?.categories;
  const tree = useMemo(() => buildTree(categories ?? []), [categories]);

  return (
    <BottomSheet open={open} onClose={onClose} title={title} ariaLabel={title} className="max-h-[70vh]">
      {tree.tops.length ? (
        // 닫히면 본문을 내려 다시 열 때 칩 선택이 지금 값으로 돌아가게 한다.
        open ? (
          <SpeciesPickerBody tree={tree} value={value} suggestedIds={suggestedIds} onSelect={onSelect} />
        ) : null
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-[14px] text-app-muted">목록을 불러오지 못했어요</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="h-9 rounded-lg border border-app-border px-4 text-[14px] font-medium text-app-text"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-app-line border-t-app-muted" />
        </div>
      )}
    </BottomSheet>
  );
}

function SpeciesPickerBody({
  tree,
  value,
  suggestedIds,
  onSelect,
}: {
  tree: SpeciesTree;
  value: string;
  suggestedIds?: readonly number[];
  onSelect: (name: string) => void;
}) {
  const suggested = (suggestedIds ?? [])
    .map((id) => tree.byId.get(id))
    .filter((item): item is CategoryItem => Boolean(item));
  const hasSuggested = suggested.length > 0;
  const [browseTabId, setBrowseTabId] = useState<number | null>(null);
  const activeTabId =
    browseTabId ?? topIdOfName(tree, value) ?? (hasSuggested ? SUGGESTED_TAB_ID : tree.tops[0]?.id);
  const activeTop =
    activeTabId === SUGGESTED_TAB_ID
      ? undefined
      : tree.tops.find((top) => top.id === activeTabId) ?? tree.tops[0];
  const descendants = activeTop ? descendantsOf(tree, activeTop.id) : [];
  const categoryRows: SpeciesRow[] = !activeTop
    ? suggested.map((item) => ({ name: item.name, label: labelOf(tree, item), depth: 1 }))
    : descendants.length === 0
      ? [{ name: activeTop.name, label: activeTop.name, depth: 1 }]
      : [
          { name: activeTop.name, label: `${activeTop.name} 전체`, depth: 1 },
          ...descendants.map(({ item, depth }) => ({ name: item.name, label: item.name, depth })),
        ];
  const rows: SpeciesRow[] = [{ name: "", label: "선택 안 함", depth: 1 }, ...categoryRows];

  const chipClass = (on: boolean) =>
    on
      ? "h-8 shrink-0 rounded-full border border-app-inverse bg-app-inverse px-3 text-[13px] font-semibold tracking-[-0.2px] text-app-inverse-text"
      : "h-8 shrink-0 rounded-full border border-app-border bg-app-elevated px-3 text-[13px] tracking-[-0.2px] text-app-sub";

  const pressTop = (top: CategoryItem) => {
    if (!(tree.childrenOf.get(top.id) ?? []).length) {
      onSelect(top.name);
      return;
    }
    setBrowseTabId(top.id);
  };

  return (
    <>
      <div className="flex h-11 items-center gap-1.5 overflow-x-auto px-4 scrollbar-hide">
        {hasSuggested ? (
          <button
            type="button"
            aria-pressed={!activeTop}
            aria-label="관심 카테고리"
            onClick={() => setBrowseTabId(SUGGESTED_TAB_ID)}
            className={chipClass(!activeTop)}
          >
            관심
          </button>
        ) : null}
        {tree.tops.map((top) => {
          const on = top.id === activeTop?.id;
          return (
            <button key={top.id} type="button" aria-pressed={on} onClick={() => pressTop(top)} className={chipClass(on)}>
              {top.name}
            </button>
          );
        })}
      </div>
      <div className="mx-4 h-px bg-app-line" />
      <ul className="pb-2 pt-1">
        {rows.map((row) => {
          const on = row.name === value;
          return (
            <li key={`${row.name}-${row.label}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(row.name)}
                style={{ paddingLeft: 16 + (row.depth - 1) * 16 }}
                className="flex h-12 w-full items-center gap-2 pr-4 text-left transition-colors hover:bg-app-surface"
              >
                <span
                  className={
                    on
                      ? "flex-1 truncate text-[16px] font-semibold tracking-[-0.3px] text-app-brand"
                      : "flex-1 truncate text-[16px] tracking-[-0.3px] text-app-text"
                  }
                >
                  {row.label}
                </span>
                {on ? (
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="text-app-brand" aria-hidden="true">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default SpeciesPickerSheet;
