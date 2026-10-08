/**
 * 카테고리 트리 조회·범위(scope) 계산. 테이블이 작아 전체를 메모리에 잠깐(60초) 캐시한다.
 * - 목록 API 는 `categoryScopeWhere(categoryPath)` 를 where 에 AND 로 붙인다.
 * - 쓰기 API 는 `resolveCategoryIdByName(종 이름)` 으로 categoryId 를 함께 저장한다.
 */
import client from "@libs/server/client";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";
import {
  CategoryItem,
  isAncestorOfCategoryPaths,
  isUnderCategoryPaths,
  parseCategoryPathParam,
} from "@libs/shared/categories";

export interface CategoryRecord extends CategoryItem {
  isVisible: boolean;
}

const CACHE_TTL_MS = 60 * 1000;
/** 기존 데이터의 별칭. 마이그레이션의 매핑 규칙과 같다. */
const LEGACY_NAME_ALIASES: Record<string, string> = {
  기타곤충: "곤충",
  "나비/나방": "곤충",
  관상어: "어류",
  메다카: "어류",
  "뱀/도마뱀/거북이": "파충류",
  파충류용품: "파충류",
  아가베: "식물",
};
/** 종이 아닌 옛 게시판 구분값. categoryId 를 비워 둔다. */
const NON_SPECIES_VALUES = new Set(["community", "general"]);
const FALLBACK_PATH = "/etc/";

let cache: { at: number; rows: CategoryRecord[] } | null = null;

export const invalidateCategoryCache = () => {
  cache = null;
};

export const getAllCategories = async (): Promise<CategoryRecord[]> => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = await client.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      path: true,
      sortOrder: true,
      isVisible: true,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const sorted = sortTree(rows);
  cache = { at: Date.now(), rows: sorted };
  return sorted;
};

/** 부모 → 자식 순(깊이 우선, 같은 부모 안에서는 sortOrder) 으로 정렬한다. 클라이언트가 트리를 바로 그리게 하려는 것이다. */
export const sortTree = (rows: CategoryRecord[]): CategoryRecord[] => {
  const byParent = new Map<number | null, CategoryRecord[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  const out: CategoryRecord[] = [];
  const walk = (parentId: number | null) => {
    const children = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
    );
    for (const child of children) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(null);
  return out;
};

/**
 * 노출 카테고리만. 조상 중 하나라도 숨김이면 하위도 숨긴다(부모를 끄면 가지째 사라져야 한다).
 */
export const getVisibleCategories = async (): Promise<CategoryItem[]> => {
  const rows = await getAllCategories();
  const hiddenPaths = rows.filter((row) => !row.isVisible).map((row) => row.path);
  return rows
    .filter((row) => !isUnderCategoryPaths(row.path, hiddenPaths))
    .map(({ isVisible: _isVisible, ...item }) => item);
};

export const getHiddenCategoryIds = async (): Promise<number[]> => {
  const rows = await getAllCategories();
  const hiddenPaths = rows.filter((row) => !row.isVisible).map((row) => row.path);
  if (!hiddenPaths.length) return [];
  return rows.filter((row) => isUnderCategoryPaths(row.path, hiddenPaths)).map((row) => row.id);
};

/** 고정 목록에서 존재하지 않거나 숨겨진 id 를 뺀다(PRD 8: 숨겨진 카테고리는 자동으로 전체 보기로). */
export const sanitizePinnedCategoryIds = async (ids: readonly number[]): Promise<number[]> => {
  const visible = new Set((await getVisibleCategories()).map((row) => row.id));
  return Array.from(new Set(ids)).filter((id) => visible.has(id));
};

/**
 * categoryPath 쿼리 값 → 범위에 드는 노출 카테고리 id 목록.
 * 범위가 없으면 null. 범위는 있는데 맞는 카테고리가 없으면 [] (아무것도 안 보인다).
 * - 고정한 카테고리와 그 하위 전부.
 * - 고정한 카테고리의 상위 분류 자체(그 형제는 빼고). 소분류 없이 '포유류'로만 단 글·상품이
 *   강아지·햄스터 고정 화면에도 보이게 하려는 것이다(2026-10-09 결정).
 */
export const resolveScopeCategoryIds = async (
  categoryPath: string | string[] | undefined | null
): Promise<number[] | null> => {
  const roots = parseCategoryPathParam(categoryPath);
  if (!roots) return null;
  const visible = await getVisibleCategories();
  const visiblePaths = new Set(visible.map((row) => row.path));
  // 숨겼거나 없는 카테고리를 고정했으면 상위를 끌어오지 않는다.
  const liveRoots = roots.filter((root) => visiblePaths.has(root));
  return visible
    .filter(
      (row) =>
        isUnderCategoryPaths(row.path, roots) || isAncestorOfCategoryPaths(row.path, liveRoots)
    )
    .map((row) => row.id);
};

/**
 * 목록 where 에 AND 로 붙일 카테고리 조건.
 * - 범위가 있으면 그 안의 노출 카테고리만.
 * - 범위가 없으면(전체 보기) 숨긴 카테고리의 글만 뺀다. categoryId 가 없는 글은 그대로 보인다.
 */
export const categoryScopeWhere = async (
  categoryPath: string | string[] | undefined | null
): Promise<Record<string, unknown>> => {
  const ids = await resolveScopeCategoryIds(categoryPath);
  if (ids) return { categoryId: { in: ids } };
  const hidden = await getHiddenCategoryIds();
  if (!hidden.length) return {};
  return { OR: [{ categoryId: null }, { categoryId: { notIn: hidden } }] };
};

/**
 * 반려생활 종 드롭다운(`species=포유류`) → 목록 where 조건.
 * 트리에 있는 이름이면 그 카테고리와 하위 전부를 categoryId 로 찾는다(글에 '강아지'처럼 소분류 이름이
 * 저장돼도 '포유류'로 찾게 하려는 것이다). 트리에 없는 이름이면 예전처럼 이름으로 비교한다.
 */
export const speciesCategoryWhere = async (
  species: string
): Promise<Record<string, unknown>> => {
  const rows = await getAllCategories();
  const target = LEGACY_NAME_ALIASES[species] ?? species;
  const found = rows.find((row) => row.name === target);
  if (!found) return { type: { in: getCategoryFilterValues(species) } };
  return {
    categoryId: {
      in: rows.filter((row) => isUnderCategoryPaths(row.path, [found.path])).map((row) => row.id),
    },
  };
};

/**
 * 종 이름(기존 문자열 카테고리) → Category.id. 이름이 비어 있으면 null,
 * 이름은 있는데 트리에 없으면 '기타'. 숨긴 카테고리라도 쓰기는 막지 않는다(노출 토글은 조회에서만 적용).
 */
export const resolveCategoryIdByName = async (
  name: string | null | undefined
): Promise<number | null> => {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed || NON_SPECIES_VALUES.has(trimmed)) return null;
  const rows = await getAllCategories();
  const target = LEGACY_NAME_ALIASES[trimmed] ?? trimmed;
  const found = rows.find((row) => row.name === target);
  if (found) return found.id;
  return rows.find((row) => row.path === FALLBACK_PATH)?.id ?? null;
};
