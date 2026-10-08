"use client";
/**
 * 관심 카테고리 고정(Pin) 상태 — 앱 src/lib/categoryScope.ts 를 웹으로 옮긴 것. 브라우저(localStorage)에 저장하고,
 * 로그인 중이면 서버(/api/users/me pinnedCategoryIds)와 맞춘다(CategoryScopeSync).
 * 홈 상품·반려생활 게시글/HOT 토론·TOP 브리더·랭킹이 모두 이 하나의 범위(categoryPath)를 쓴다
 * (화면마다 필터를 따로 두지 않는다 — bredy_app docs/prd/category-pin.md).
 *
 * - 고정 항목은 id 와 이름·path 스냅샷을 함께 저장해, 카테고리 목록을 받기 전에도 범위를 바로 적용한다.
 * - 조상이 함께 고정돼 있으면 하위는 뺀다(범위가 같다). 최대 MAX_PINNED_CATEGORIES 개.
 * - 서버 렌더와 첫 클라이언트 렌더는 항상 '복원 전'(hydrated:false) 상태라 하이드레이션이 어긋나지 않는다.
 *   CategoryScopeSync 가 마운트되면서 localStorage 를 읽어 hydrated:true 로 바꾼다.
 */
import { useSyncExternalStore } from "react";
import {
  MAX_PINNED_CATEGORIES,
  joinCategoryPaths,
  type CategoryItem,
} from "@libs/shared/categories";

export { MAX_PINNED_CATEGORIES };

export interface PinnedCategory {
  id: number;
  name: string;
  path: string;
  /** "포유류 > 햄스터" 처럼 조상 이름을 이은 표시용 라벨. */
  label: string;
}

export interface CategoryScopeState {
  pins: PinnedCategory[];
  /** 이 브라우저에서 관심 카테고리 온보딩을 마쳤거나 건너뛰었는지. */
  onboarded: boolean;
  /** localStorage 복원이 끝났는지. 끝나기 전엔 범위를 적용하지 않는다. */
  hydrated: boolean;
}

export const ALL_SCOPE_LABEL = "전체 보기";

export const CATEGORY_SCOPE_PINS_KEY = "bredy:categoryScope:pins";
export const CATEGORY_SCOPE_ONBOARDED_KEY = "bredy:categoryScope:onboarded";

const SERVER_STATE: CategoryScopeState = Object.freeze({
  pins: [],
  onboarded: false,
  hydrated: false,
}) as CategoryScopeState;

let state: CategoryScopeState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit(next: CategoryScopeState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getCategoryScopeState() {
  return state;
}

export function subscribeCategoryScope(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCategoryScopeState() {
  return useSyncExternalStore(
    subscribeCategoryScope,
    getCategoryScopeState,
    () => SERVER_STATE
  );
}

const isPinnedCategory = (value: unknown): value is PinnedCategory =>
  typeof value === "object" &&
  value !== null &&
  Number.isInteger((value as PinnedCategory).id) &&
  typeof (value as PinnedCategory).name === "string" &&
  typeof (value as PinnedCategory).path === "string" &&
  typeof (value as PinnedCategory).label === "string";

/** 조상이 함께 있으면 하위를 빼고, 중복을 없애고, 개수를 자른다. */
export function normalizePins(pins: readonly PinnedCategory[]): PinnedCategory[] {
  const unique = pins.filter(
    (pin, index) => pins.findIndex((other) => other.id === pin.id) === index
  );
  return unique
    .filter(
      (pin) =>
        !unique.some((other) => other.id !== pin.id && pin.path.startsWith(other.path))
    )
    .slice(0, MAX_PINNED_CATEGORIES);
}

/** 범위 쿼리 값(path 쉼표 목록). 고정이 없으면 undefined(전체 보기). */
export function toCategoryPath(pins: readonly PinnedCategory[]) {
  return pins.length ? joinCategoryPaths(pins.map((pin) => pin.path)) : undefined;
}

/** 홈 범위 바·설정 행에 보이는 범위 이름. */
export function formatScopeLabel(pins: readonly PinnedCategory[]) {
  if (pins.length === 0) return ALL_SCOPE_LABEL;
  if (pins.length === 1) return pins[0].label;
  return `${pins[0].label} 외 ${pins.length - 1}`;
}

/** 카테고리 목록에서 "포유류 > 햄스터" 라벨을 만든다. */
export function categoryLabel(item: CategoryItem, categories: readonly CategoryItem[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const names: string[] = [];
  let current: CategoryItem | undefined = item;
  while (current) {
    names.unshift(current.name);
    current = current.parentId == null ? undefined : byId.get(current.parentId);
  }
  return names.join(" > ");
}

export function toPinnedCategory(
  item: CategoryItem,
  categories: readonly CategoryItem[]
): PinnedCategory {
  return { id: item.id, name: item.name, path: item.path, label: categoryLabel(item, categories) };
}

/** 저장된 JSON 을 고정 목록으로 푼다. 깨졌으면 빈 목록. */
export function parseStoredPins(raw: string | null): PinnedCategory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizePins(parsed.filter(isPinnedCategory)) : [];
  } catch {
    return [];
  }
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 범위 적용(메모리)을 막지 않는다. 로그인 중이면 서버 값이 남는다.
  }
}

/** 렌더 밖(로그인 직후 이동 결정 등)에서 저장된 값을 바로 읽는다. */
export function readStoredCategoryScope(): Pick<CategoryScopeState, "pins" | "onboarded"> {
  if (typeof window === "undefined") return { pins: [], onboarded: false };
  return {
    pins: parseStoredPins(readStorage(CATEGORY_SCOPE_PINS_KEY)),
    onboarded: readStorage(CATEGORY_SCOPE_ONBOARDED_KEY) === "1",
  };
}

export function restoreCategoryScope(): CategoryScopeState {
  if (state.hydrated) return state;
  emit({ ...readStoredCategoryScope(), hydrated: true });
  return state;
}

/** 고정 목록을 바꾼다(브라우저 저장). 서버 반영은 CategoryScopeSync 가 상태 변화를 보고 한다. */
export function setPinnedCategories(pins: readonly PinnedCategory[]) {
  const next = normalizePins(pins);
  emit({ ...state, pins: next, hydrated: true });
  writeStorage(CATEGORY_SCOPE_PINS_KEY, JSON.stringify(next));
}

export function markCategoryOnboardingDone() {
  emit({ ...state, onboarded: true, hydrated: true });
  writeStorage(CATEGORY_SCOPE_ONBOARDED_KEY, "1");
}

/**
 * 받은 카테고리 목록으로 고정 항목의 이름·path 를 새로 맞추고, 목록에 없는(숨긴·삭제된) 항목을 뺀다.
 * 뺀 항목 이름을 돌려준다(안내 문구용). 바뀐 게 없으면 빈 배열.
 */
export function reconcilePinsWithCategories(categories: readonly CategoryItem[]): string[] {
  if (!state.hydrated || state.pins.length === 0) return [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const dropped: string[] = [];
  const next: PinnedCategory[] = [];
  for (const pin of state.pins) {
    const item = byId.get(pin.id);
    if (item) next.push(toPinnedCategory(item, categories));
    else dropped.push(pin.label);
  }
  const normalized = normalizePins(next);
  const changed =
    normalized.length !== state.pins.length ||
    normalized.some(
      (pin, i) =>
        pin.id !== state.pins[i].id ||
        pin.path !== state.pins[i].path ||
        pin.label !== state.pins[i].label
    );
  if (changed) setPinnedCategories(normalized);
  return dropped;
}

/** 서버(/api/users/me)의 고정 id 를 받아 이 브라우저의 고정으로 삼는다. 계정이 이미 골랐으니 온보딩도 마친 것으로 본다. */
export function adoptServerPins(ids: readonly number[], categories: readonly CategoryItem[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pins = ids
    .map((id) => byId.get(id))
    .filter((item): item is CategoryItem => Boolean(item))
    .map((item) => toPinnedCategory(item, categories));
  setPinnedCategories(pins);
  markCategoryOnboardingDone();
}

export const samePinIds = (pins: readonly PinnedCategory[], ids: readonly number[]) =>
  pins.length === ids.length && pins.every((pin, i) => pin.id === ids[i]);

export type ScopeSyncPlan = "adopt" | "wait-categories" | "in-sync" | "push";

/**
 * 계정마다 처음 한 번의 동기화 방향(앱 CategoryScopeSync 와 같은 규칙).
 * - 브라우저에 고정이 없고 서버에 있으면 서버 값을 받는다(이름·path 를 만들려면 카테고리 목록이 있어야 한다).
 * - 서버와 같으면 할 일이 없다.
 * - 그 밖(브라우저에 고정이 있거나 둘 다 비어 있는데 서버 값이 없음)은 브라우저 값을 서버에 올린다.
 */
export function planInitialScopeSync(
  localIds: readonly number[],
  serverIds: readonly number[] | undefined,
  hasCategories: boolean
): ScopeSyncPlan {
  if (localIds.length === 0 && serverIds && serverIds.length > 0) {
    return hasCategories ? "adopt" : "wait-categories";
  }
  if (
    serverIds &&
    serverIds.length === localIds.length &&
    serverIds.every((id, i) => id === localIds[i])
  ) {
    return "in-sync";
  }
  return "push";
}

export type OnboardedSyncPlan = "adopt" | "push" | "none";

/**
 * 온보딩을 마쳤다는 표시(계정 categoryOnboardedAt ↔ 이 브라우저 onboarded)를 맞춘다.
 * 계정이 이미 마쳤으면 이 브라우저도 마친 것으로 두고, 이 브라우저만 마쳤으면 계정에 올린다(앱·웹 공유, 대응표 O-1).
 */
export function planOnboardedSync(localOnboarded: boolean, serverOnboardedAt: unknown): OnboardedSyncPlan {
  const serverDone = Boolean(serverOnboardedAt);
  if (serverDone && !localOnboarded) return "adopt";
  if (!serverDone && localOnboarded) return "push";
  return "none";
}

/** 테스트용: 모듈 상태를 처음으로 되돌린다. */
export function resetCategoryScopeForTest() {
  emit(SERVER_STATE);
}
