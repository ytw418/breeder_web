/**
 * 대분류를 고르면 아래에 뜨는 소분류 칩 목록(홈 분양·반려생활 종, 2026-10-12).
 * 앱 bredy_app src/lib/subcategoryChips.ts 와 같은 사본이다. 함께 고치고 웹 jest·앱 npm run test:subcategory-chips 로 확인한다.
 *
 * 관심 카테고리를 소분류로 고정했으면(예: "포유류 > 햄스터") 그 대분류 아래에선 고정한 소분류만 보인다.
 * 대분류째 고정했거나 고정이 없으면 소분류를 모두 보인다.
 */
export const ALL_SUBCATEGORY = "";

export function subcategoryChipOptions(
  parent: string,
  children: readonly string[],
  pinLabels: readonly string[],
): string[] {
  if (!parent || children.length === 0) return [];
  const labels = pinLabels.filter((label) => label === parent || label.startsWith(`${parent} > `));
  if (labels.length === 0 || labels.includes(parent)) return [...children];
  const pinned = children.filter((child) =>
    labels.some((label) => label === `${parent} > ${child}` || label.startsWith(`${parent} > ${child} > `)),
  );
  return pinned.length > 0 ? pinned : [...children];
}

/** 대분류가 바뀌었거나 범위 밖으로 나간 소분류는 '전체'로 돌린다. */
export function activeSubcategory(value: string, options: readonly string[]): string {
  return options.includes(value) ? value : ALL_SUBCATEGORY;
}

/** 서버에 보낼 종 값: 소분류를 골랐으면 소분류, 아니면 대분류("전체"면 undefined). */
export function categoryQueryValue(parent: string, sub: string): string | undefined {
  if (sub) return sub;
  return parent && parent !== "전체" ? parent : undefined;
}
