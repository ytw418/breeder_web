/**
 * 보호소 공고 글(Product.externalSource 있음) 상세의 검색 메타.
 * 2026-10-24 사용자 결정: 색인한다. 아래 키워드를 제목·설명·keywords 에 자연스럽게 넣는다.
 *  - 강아지: 강아지 무료분양, 무료입양, 주인 찾아요, 강아지 키워주세요, 유기견 보호소, 유기견 입양
 *  - 고양이: 고양이 무료분양, 무료입양, 주인 찾아요, 고양이 키워주세요, 유기묘 보호소, 유기묘 입양
 */
import { parsePetInfo } from "./petSpace";
import { shelterWhoOfTitle } from "./shelterAnimal";

export interface ShelterSeoInput {
  /** 글 제목(시군구·품종·성별이 들어 있다, 앱 docs/prd/shelter-animals.md AC-4). */
  name: string;
  /** 강아지 | 고양이. 고양이가 아니면 강아지 문구를 쓴다. */
  category: string | null;
  regionSido?: string | null;
  regionSigungu?: string | null;
  /** Product.petInfo(JSON). 제목에서 품종·성별을 못 되찾을 때 성별만 쓴다. */
  petInfo?: unknown;
}

export interface ShelterSeo {
  /** 레이아웃 제목 템플릿(' | 브리디')을 붙이지 않는 완성 제목(title.absolute 로 쓴다). */
  title: string;
  description: string;
  keywords: string[];
}

/** 제목이 이 길이를 넘으면 품종·성별 부분을 줄인다(검색 결과에서 보이는 길이 기준, 대략 60자). */
const TITLE_SOFT_MAX = 70;

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();

/** 제목 뒤에 붙는 문구(검색 결과에서 '입양 가족을 찾는 글'로 읽히게). */
const TITLE_SUFFIX = " 새 가족 찾아요";

const SEX_WORD: Record<string, string> = { male: "남아", female: "여아" };

export function buildShelterSeo({ name, category, regionSido, regionSigungu, petInfo }: ShelterSeoInput): ShelterSeo {
  const isCat = category === "고양이";
  const species = isCat ? "고양이" : "강아지";
  const stray = isCat ? "유기묘" : "유기견";
  const location = collapse(regionSigungu || regionSido || "");
  const head = `${location ? `${location} ` : ""}${stray} 입양`;
  const tail = `${species} 무료분양·무료입양 - 브리디`;

  // 품종·성별: 동기화가 만든 제목에서 되찾고(글 제목을 오려 쓰지 않는다), 안 맞으면 종 + petInfo 성별.
  const sex = SEX_WORD[parsePetInfo(petInfo)?.sex ?? ""] ?? "";
  const who = shelterWhoOfTitle(name) ?? `${species}${sex ? ` ${sex}` : ""}`;
  // 머리·꼬리·구분자(' · ', ' | ')·뒤 문구를 뺀 나머지 자리만 품종·성별에 쓴다.
  const budget = Math.max(TITLE_SOFT_MAX - head.length - tail.length - " · ".length - " | ".length - TITLE_SUFFIX.length, 8);
  const detail = who.length <= budget ? who : `${who.slice(0, budget - 1).trimEnd()}…`;
  const title = `${head} · ${detail}${TITLE_SUFFIX} | ${tail}`;

  const where = location ? `${location} ${stray} 보호소` : `${stray} 보호소`;
  const description = collapse(
    `${collapse(name)}. ${where}에서 주인 찾아요, ${species} 키워주세요. ` +
      `${species} 무료분양·무료입양 문의는 보호소로, ${stray} 입양은 브리디에서 확인하세요.`
  );

  const keywords = Array.from(
    new Set([
      `${species} 무료분양`,
      "무료입양",
      "주인 찾아요",
      `${species} 키워주세요`,
      `${stray} 보호소`,
      `${stray} 입양`,
      ...(location ? [`${location} ${stray} 입양`, `${location} ${species} 무료분양`] : []),
      "브리디",
      collapse(name),
    ])
  );

  return { title, description, keywords };
}
