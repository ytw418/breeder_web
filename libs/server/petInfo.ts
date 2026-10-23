import { Prisma } from "@prisma/client";
import { isNoPriceCategory, NO_PRICE_CATEGORIES, parsePetInfo, type PetInfo } from "@libs/shared/petSpace";

/** 강아지·고양이 분양글 정보 → Product.petInfo 저장 값. null 이면 SQL NULL. */
export function petInfoDbValue(info: PetInfo | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!info) return Prisma.DbNull;
  return { ...info } as Prisma.InputJsonValue;
}

/** 저장된 JSON → 규칙에 맞는 값만 남긴 PetInfo(없거나 틀리면 null). 응답에 넣기 전에 거른다. */
export const readStoredPetInfo = (stored: unknown): PetInfo | null => parsePetInfo(stored);

/**
 * 상세 '비슷한 분양'을 같은 무리 안에서만 찾는 조건(앱 docs/prd/pet-space.md §5.8).
 * 강아지·고양이 글엔 강아지·고양이 글만, 다른 글엔 강아지·고양이 글을 뺀다 — 임보 글 아래 가격표 붙은 파충류 분양이 섞이지 않게.
 * category 가 없는 옛 글은 다른 글 쪽에 남긴다(NOT IN 은 NULL 을 빼므로 따로 넣는다).
 */
export function relatedPetGroupWhere(category: string | null | undefined): Prisma.ProductWhereInput {
  if (isNoPriceCategory(category)) return { category: { in: [...NO_PRICE_CATEGORIES] } };
  return { OR: [{ category: null }, { category: { notIn: [...NO_PRICE_CATEGORIES] } }] };
}
