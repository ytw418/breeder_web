import { Prisma } from "@prisma/client";
import { parsePetInfo, type PetInfo } from "@libs/shared/petSpace";

/** 강아지·고양이 분양글 정보 → Product.petInfo 저장 값. null 이면 SQL NULL. */
export function petInfoDbValue(info: PetInfo | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!info) return Prisma.DbNull;
  return { ...info } as Prisma.InputJsonValue;
}

/** 저장된 JSON → 규칙에 맞는 값만 남긴 PetInfo(없거나 틀리면 null). 응답에 넣기 전에 거른다. */
export const readStoredPetInfo = (stored: unknown): PetInfo | null => parsePetInfo(stored);
