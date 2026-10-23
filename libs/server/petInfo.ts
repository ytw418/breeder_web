import { Prisma } from "@prisma/client";
import {
  isNoPriceCategory,
  NO_PRICE_CATEGORIES,
  parsePetInfo,
  showsPetRegion,
  type PetInfo,
} from "@libs/shared/petSpace";
import { regionOf } from "@libs/shared/regions";

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

/**
 * 가족 찾아요·임보 구해요 글에 남길 작성자 동네(앱 docs/prd/pet-space.md §5.9) → Product.regionSido·regionSigungu.
 * show 는 validateProductInput 의 showPetRegion 이다. undefined 면 손대지 않는다(옛 앱, 다른 칸만 고친 수정).
 * 켰고 저장될 글이 강아지·고양이 가족 찾아요·임보 구해요이며 작성자 동네가 있으면 그 동네, 아니면 둘 다 null.
 * author 는 글 주인이다(운영자가 고쳐도 주인 동네). 등록·수정 때마다 그때 프로필 동네를 다시 복사한다.
 */
export function petRegionColumns(
  show: boolean | undefined,
  post: { category: string | null | undefined; dealType: string | null | undefined },
  author: { regionSido?: string | null; regionSigungu?: string | null } | null
): { regionSido: string | null; regionSigungu: string | null } | undefined {
  if (show === undefined) return undefined;
  const region =
    show && isNoPriceCategory(post.category) && showsPetRegion(post.dealType) ? regionOf(author) : null;
  return { regionSido: region?.sido ?? null, regionSigungu: region?.sigungu ?? null };
}
