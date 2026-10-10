"use client";
/**
 * 관심 카테고리 고정(Pin) 선택 화면(앱 CategoryScopePicker). 온보딩(첫 로그인 직후)과 설정 > 관심 카테고리가 같이 쓴다.
 * 시안 규칙(당근 톤): 흰 배경, 52 행, 1px 라인, 주황은 선택 상태·CTA 에만.
 * - 트리는 깊이 제한이 없다. 하위가 있는 행은 왼쪽 화살표로 펼친다.
 * - 부모를 고르면 하위는 "포함"으로 보이고 따로 고를 수 없다(고정 범위가 같다).
 * - 여러 개 고를 수 있다(최대 MAX_PINNED_CATEGORIES). 1단계는 파충류·어류를 맨 위에 둔다.
 */
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import useCategoryScope, { CATEGORIES_KEY } from "hooks/useCategoryScope";
import {
  MAX_PINNED_CATEGORIES,
  markCategoryOnboardingDone,
  normalizePins,
  setPinnedCategories,
  toPinnedCategory,
  useCategoryScopeState,
  type PinnedCategory,
} from "@libs/client/categoryScope";
import { getSafeNextPath } from "@libs/client/postLogin";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import type { CategoriesResponse, CategoryItem } from "@libs/shared/categories";

/** 1단계에서 선택지 맨 위에 두는 최상위 slug 순서. 나머지는 서버 sortOrder. */
const PRIORITY_TOP_SLUGS = ["reptile", "fish"];
const INDENT = 24;

type Row = { item: CategoryItem; depth: number; hasChildren: boolean; expanded: boolean };

function CheckCircle({ state }: { state: "on" | "off" | "implied" }) {
  if (state === "off") {
    return (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-app-border">
        <circle cx={12} cy={12} r={10.5} stroke="currentColor" strokeWidth={1.5} />
      </svg>
    );
  }
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx={12} cy={12} r={11} className={state === "on" ? "fill-app-brand" : "fill-app-placeholder"} />
      <path
        d="M7.5 12.5l3 3 6-6"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={state === "on" ? "stroke-white" : "stroke-app-muted"}
      />
    </svg>
  );
}

function Chevron({ down }: { down: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-caption">
      <path d={down ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** path 의 조상 id 목록(자기 자신 제외). */
function ancestorIdsOf(path: string, categories: readonly CategoryItem[]) {
  const ids: number[] = [];
  const slugs = path.split("/").filter(Boolean);
  let prefix = "/";
  for (const slug of slugs.slice(0, -1)) {
    prefix += `${slug}/`;
    const found = categories.find((c) => c.path === prefix);
    if (found) ids.push(found.id);
  }
  return ids;
}

export default function CategoryScopePicker({ mode }: { mode: "onboarding" | "settings" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pins } = useCategoryScopeState();
  const { label: currentLabel } = useCategoryScope();
  const { data, error, mutate, isLoading } = useSWR<CategoriesResponse>(CATEGORIES_KEY, {
    revalidateOnFocus: false,
  });
  const categories = useMemo(() => (data?.success ? data.categories : []), [data]);

  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number> | null>(null);
  const [saving, setSaving] = useState(false);
  // 복원·목록 도착 전에는 저장된 고정을 기본값으로 본다(처음 손대는 순간 상태로 굳힌다).
  const selected = useMemo(() => selectedIds ?? new Set(pins.map((pin) => pin.id)), [selectedIds, pins]);
  const expanded = useMemo(
    () => expandedIds ?? new Set(pins.flatMap((pin) => ancestorIdsOf(pin.path, categories))),
    [expandedIds, pins, categories]
  );

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const childrenOf = useMemo(() => {
    const map = new Map<number | null, CategoryItem[]>();
    for (const item of categories) {
      const list = map.get(item.parentId) ?? [];
      list.push(item);
      map.set(item.parentId, list);
    }
    const top = map.get(null) ?? [];
    map.set(
      null,
      [...top].sort((a, b) => {
        const pa = PRIORITY_TOP_SLUGS.indexOf(a.slug);
        const pb = PRIORITY_TOP_SLUGS.indexOf(b.slug);
        const ra = pa === -1 ? PRIORITY_TOP_SLUGS.length : pa;
        const rb = pb === -1 ? PRIORITY_TOP_SLUGS.length : pb;
        return ra - rb || a.sortOrder - b.sortOrder || a.id - b.id;
      })
    );
    return map;
  }, [categories]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (parentId: number | null, depth: number) => {
      for (const item of childrenOf.get(parentId) ?? []) {
        const children = childrenOf.get(item.id) ?? [];
        const isExpanded = expanded.has(item.id);
        out.push({ item, depth, hasChildren: children.length > 0, expanded: isExpanded });
        if (isExpanded) walk(item.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [childrenOf, expanded]);

  /** 조상이 선택돼 있으면 이 항목은 "포함" 상태다. */
  const impliedBy = useCallback(
    (item: CategoryItem) => {
      let current = item.parentId == null ? undefined : byId.get(item.parentId);
      while (current) {
        if (selected.has(current.id)) return current;
        current = current.parentId == null ? undefined : byId.get(current.parentId);
      }
      return undefined;
    },
    [byId, selected]
  );

  const toggle = (item: CategoryItem) => {
    if (impliedBy(item)) return;
    const next = new Set(selected);
    if (next.has(item.id)) {
      next.delete(item.id);
      setSelectedIds(next);
      return;
    }
    // 부모를 고르면 그 아래 고른 하위는 뺀다(범위가 같다).
    for (const id of Array.from(next)) {
      const other = byId.get(id);
      if (other && other.path.startsWith(item.path)) next.delete(id);
    }
    if (next.size >= MAX_PINNED_CATEGORIES) {
      toast.info(`관심 카테고리는 최대 ${MAX_PINNED_CATEGORIES}개까지 고정할 수 있어요`);
      return;
    }
    next.add(item.id);
    setSelectedIds(next);
  };

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const selectedPins: PinnedCategory[] = useMemo(
    () =>
      normalizePins(
        Array.from(selected)
          .map((id) => byId.get(id))
          .filter((item): item is CategoryItem => Boolean(item))
          .map((item) => toPinnedCategory(item, categories))
      ),
    [selected, byId, categories]
  );

  const finish = (nextPins: PinnedCategory[]) => {
    if (saving) return;
    setSaving(true);
    setPinnedCategories(nextPins);
    if (mode === "onboarding") {
      markCategoryOnboardingDone();
      router.replace(getSafeNextPath(searchParams?.get("next")));
      return;
    }
    toast.success(nextPins.length ? "관심 카테고리를 고정했어요" : "전체 보기로 바꿨어요");
    if (window.history.length > 1) router.back();
    else router.replace("/settings");
  };

  const loadingList = isLoading && categories.length === 0;
  const ctaLabel = selectedPins.length
    ? `${selectedPins.length}개 카테고리로 고정`
    : mode === "onboarding"
      ? "전체 보기로 둘러보기"
      : "전체 보기";

  const body = (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-app-bg">
      <div className="px-4 pb-3 pt-4">
        <h2 className="text-[20px] font-bold tracking-[-0.4px] text-app-strong">
          {mode === "onboarding" ? "어떤 분야에 관심 있으세요?" : "관심 카테고리"}
        </h2>
        <p className="mt-1.5 text-[14px] leading-5 text-app-muted">
          {mode === "onboarding"
            ? "고정하면 홈 분양·반려생활·TOP 브리더가 그 분야만 보여요. 여러 개 골라도 되고, 나중에 설정에서 바꿀 수 있어요."
            : `지금은 '${currentLabel}'로 보고 있어요. 고정한 분야와 그 하위 분류만 홈·반려생활·TOP 브리더에 나와요.`}
        </p>
      </div>

      <div className="flex-1">
        {error && categories.length === 0 ? (
          <QueryErrorState onRetry={() => void mutate()} />
        ) : loadingList ? (
          <LoadingBlock />
        ) : (
          <div className="pb-4">
            <div className="mx-4 h-px bg-app-line" />
            {rows.map((row) => {
              const implied = impliedBy(row.item);
              const on = selected.has(row.item.id);
              const state = on ? "on" : implied ? "implied" : "off";
              const isTop = row.depth === 0;
              return (
                <div
                  key={row.item.id}
                  className="flex h-[52px] items-center pr-4"
                  style={{ paddingLeft: 16 + row.depth * INDENT }}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      aria-label={row.expanded ? "하위 분류 접기" : "하위 분류 펼치기"}
                      aria-expanded={row.expanded}
                      onClick={() => toggleExpand(row.item.id)}
                      className="-ml-4 grid h-[52px] w-11 shrink-0 place-items-center"
                    >
                      <Chevron down={row.expanded} />
                    </button>
                  ) : (
                    <span className="w-7 shrink-0" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on || Boolean(implied)}
                    aria-disabled={Boolean(implied)}
                    aria-label={row.item.name}
                    onClick={() => toggle(row.item)}
                    className="flex h-full min-w-0 flex-1 items-center text-left"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        isTop ? "text-[16px] font-medium" : "text-[15px] font-normal",
                        implied ? "text-app-muted" : "text-app-text"
                      )}
                    >
                      {row.item.name}
                    </span>
                    {implied ? (
                      <span className="mr-2 shrink-0 text-[12px] text-app-muted">{implied.name}에 포함</span>
                    ) : null}
                    <CheckCircle state={state} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-app-line bg-app-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={saving || loadingList}
          onClick={() => finish(selectedPins)}
          className={cn(
            "h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white",
            (saving || loadingList) && "opacity-60"
          )}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );

  if (mode === "settings") {
    return (
      <Layout canGoBack title="관심 카테고리" seoTitle="관심 카테고리">
        {body}
      </Layout>
    );
  }
  return (
    <Layout headerVariant="none" seoTitle="관심 카테고리">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-end bg-app-bg px-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => finish([])}
          className="h-11 px-2 text-[15px] text-app-muted"
        >
          건너뛰기
        </button>
      </header>
      {body}
    </Layout>
  );
}
