/**
 * 보호소 아이들 2열 카드의 글자(앱 design/mockups/adoption-v2/A-karrot.html .gc): 제목 '말티즈 여아', 둘째 줄 '수원 · 2021년생 · 3.2kg'.
 * 앱 bredy_app src/lib/shelterCard.ts = 웹 libs/shared/shelterCard.ts 사본이라 함께 고친다.
 */

import { parsePetInfo } from "./petSpace";
import { SIDO_SHORT } from "./regions";

type CardItem = {
  category?: string | null;
  petInfo?: unknown;
  regionSido?: string | null;
  regionSigungu?: string | null;
  externalBreed?: string | null;
  externalWeightKg?: number | null;
};

const SEX_WORD: Record<string, string> = { male: "남아", female: "여아" };

/** '말티즈 여아'. 품종을 모르면(기타) 강아지·고양이로 부르고, 성별을 모르면 뺀다. */
export function shelterCardTitle(item: CardItem): string {
  const breed = item.externalBreed?.trim() || item.category?.trim() || "보호소 아이";
  const sex = SEX_WORD[parsePetInfo(item.petInfo)?.sex ?? ""];
  return sex ? `${breed} ${sex}` : breed;
}

/** 시/군 이름에서 '시·군·구'를 뗀 짧은 동네: 수원시 → 수원, 서울특별시 강남구 → 서울, 세종 → 세종. 동네를 모르면 null. */
export function shelterCityLabel(item: Pick<CardItem, "regionSido" | "regionSigungu">): string | null {
  const sido = item.regionSido?.trim();
  const sigungu = item.regionSigungu?.trim();
  if (!sido) return null;
  const short = SIDO_SHORT[sido] ?? sido;
  if (!sigungu || sigungu === sido || /(특별시|광역시|특별자치시)$/.test(sido)) return short;
  const local = sigungu.length > 2 ? sigungu.replace(/(시|군|구)$/, "") : sigungu;
  return local || short;
}

/** 3.2 → '3.2kg', 11 → '11kg'. 모르면 null. */
export function shelterWeightLabel(weightKg: number | null | undefined): string | null {
  return typeof weightKg === "number" && Number.isFinite(weightKg) && weightKg > 0 ? `${Number(weightKg.toFixed(1))}kg` : null;
}

/** '수원 · 2021년생 · 3.2kg'. 빈 값은 뺀다. */
export function shelterCardMeta(item: CardItem): string {
  return [shelterCityLabel(item), parsePetInfo(item.petInfo)?.age, shelterWeightLabel(item.externalWeightKg)]
    .filter(Boolean)
    .join(" · ");
}
