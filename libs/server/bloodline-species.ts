import { getVisibleCategories } from "@libs/server/categories";

/**
 * 혈통 종(speciesType) 검증(설계 §5.6). 종 선택지의 단일 출처는 #173 의 Category 트리다
 * (`GET /api/categories` 와 같은 노출 카테고리, 포유류 아래 강아지·고양이 포함).
 * 값은 노출 카테고리의 `name` 과 정확히 같아야 한다. 레거시 별칭(기타곤충 등)은 새로 만들 때 받지 않는다.
 * 하위가 없는 상위(기타)는 그 자체로 고를 수 있으므로 깊이는 따지지 않는다.
 */
export type BloodlineSpeciesResult =
  | { ok: true; speciesType: string; categoryId: number }
  | { ok: false; errorCode: "BLOODLINE_SPECIES_REQUIRED" | "BLOODLINE_INVALID_SPECIES" };

export async function resolveBloodlineSpecies(value: unknown): Promise<BloodlineSpeciesResult> {
  if (value === undefined || value === null) return { ok: false, errorCode: "BLOODLINE_SPECIES_REQUIRED" };
  if (typeof value !== "string") return { ok: false, errorCode: "BLOODLINE_INVALID_SPECIES" };
  const name = value.trim();
  if (!name) return { ok: false, errorCode: "BLOODLINE_SPECIES_REQUIRED" };

  const categories = await getVisibleCategories();
  const found = categories.find((category) => category.name === name);
  if (!found) return { ok: false, errorCode: "BLOODLINE_INVALID_SPECIES" };
  return { ok: true, speciesType: found.name, categoryId: found.id };
}

export async function isSelectableBloodlineSpecies(value: unknown): Promise<boolean> {
  return (await resolveBloodlineSpecies(value)).ok;
}
