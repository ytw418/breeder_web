export type CategoryNode = {
  id: string;
  name: string;
  children?: readonly string[];
};

export const CATEGORY_TREE: readonly CategoryNode[] = [
  { id: "곤충", name: "곤충", children: ["장수풍뎅이", "사슴벌레", "개미", "나비", "사마귀", "밀웜/귀뚜라미"] },
  { id: "절지류", name: "절지류", children: ["타란튤라", "지네", "전갈", "등각류", "기타 절지류"] },
  { id: "파충류", name: "파충류", children: ["레오파드 게코", "크레스티드 게코", "볼파이썬", "콘스네이크", "이구아나", "카멜레온", "육지거북", "수생거북"] },
  { id: "어류", name: "어류", children: ["구피", "베타", "코리도라스", "안시스트루스", "디스커스", "금붕어"] },
  { id: "포유류", name: "포유류", children: ["고슴도치", "햄스터", "기니피그", "토끼", "페럿", "친칠라"] },
  { id: "양서류", name: "양서류", children: ["팩맨", "엑솔로틀", "화이트트리프록", "다트프록", "뉴트"] },
  { id: "식물", name: "식물", children: ["관엽식물", "다육식물", "식충식물", "테라리움 식물", "수초"] },
] as const;

const LEGACY_CATEGORY_ALIASES: Record<string, string[]> = {
  곤충: ["기타곤충", "나비/나방"],
};

const categoryLookup = new Map<string, CategoryNode>(CATEGORY_TREE.map((node) => [node.id, node]));

export const TOP_LEVEL_CATEGORIES = CATEGORY_TREE.map(({ id, name }) => ({ id, name }));

export const getSubcategories = (parentId: string) => categoryLookup.get(parentId)?.children ?? [];

export const getCategoryFilterValues = (parentId: string) => {
  const current = categoryLookup.get(parentId);
  if (!current) return [parentId];
  return [parentId, ...(current.children ?? []), ...(LEGACY_CATEGORY_ALIASES[parentId] ?? [])];
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const getCategorySearchKeywords = (keyword: string) => {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  // 대분류로 검색하면 하위/레거시 별칭까지 확장
  const topLevel = categoryLookup.get(trimmed);
  if (topLevel) {
    return unique([trimmed, ...getCategoryFilterValues(trimmed)]);
  }

  // 하위분류로 검색하면 해당 부모까지 함께 검색
  for (const node of CATEGORY_TREE) {
    if (node.children?.includes(trimmed)) {
      return unique([trimmed, node.id, ...(LEGACY_CATEGORY_ALIASES[node.id] ?? [])]);
    }
  }

  return [trimmed];
};

export const findCategoryBranch = (value: string | null | undefined) => {
  if (!value) return { parent: "", child: "" };

  const parentNode = CATEGORY_TREE.find((node) => node.id === value);
  if (parentNode) return { parent: parentNode.id, child: "" };

  for (const node of CATEGORY_TREE) {
    if (node.children?.includes(value)) {
      return { parent: node.id, child: value };
    }
  }

  if (LEGACY_CATEGORY_ALIASES.곤충.includes(value)) {
    return { parent: "곤충", child: "" };
  }

  return { parent: "", child: "" };
};
