/**
 * 보호소 아이들 — 국가동물보호정보시스템 구조동물 공고(data.go.kr 1543061/abandonmentPublicService_v2)를
 * 입양 쪽 '가족 찾아요' 글(Product dealType=rehoming)로 옮기는 변환 규칙(앱 docs/prd/shelter-animals.md F-3).
 * 2026-10-24 사용자 결정: 말투는 해요체, 공고 원문을 그대로 베끼지 않고 다시 쓴다(문장 틀 여러 개 중 공고번호로 하나를 고른다).
 * 같은 입력이면 같은 결과다(순수 함수, 서버 import 없음).
 *
 * 앱 bredy_app src/lib/shelterAnimal.ts = 웹 libs/shared/shelterAnimal.ts 사본이라 함께 고친다.
 */

import type { PetInfo } from "./petSpace";
import { REGIONS, SIDO_SHORT } from "./regions";

/** Product.externalSource 에 넣는 값. */
export const SHELTER_SOURCE = "animal.go.kr";

export type ShelterSpecies = "강아지" | "고양이";

/** 공공 API 응답 한 건(필요한 칸만). 값은 모두 문자열로 온다. */
export interface ShelterApiItem {
  desertionNo?: string | number | null;
  noticeNo?: string | null;
  noticeSdt?: string | null;
  noticeEdt?: string | null;
  popfile1?: string | null;
  kindNm?: string | null;
  kindCd?: string | null;
  age?: string | null;
  weight?: string | null;
  colorCd?: string | null;
  sexCd?: string | null;
  neuterYn?: string | null;
  specialMark?: string | null;
  happenPlace?: string | null;
  careNm?: string | null;
  careTel?: string | null;
  careAddr?: string | null;
  orgNm?: string | null;
}

export interface ShelterProduct {
  name: string;
  description: string;
  category: ShelterSpecies;
  productType: "생물";
  dealType: "rehoming";
  petInfo: PetInfo;
  /** 회원 글과 같은 형식(REGIONS 의 시/도 전체 이름 + 시/군/구). 알 수 없으면 둘 다 null. */
  regionSido: string | null;
  regionSigungu: string | null;
  photos: string[];
  externalSource: typeof SHELTER_SOURCE;
  externalId: string;
  noticeNo: string;
  /** 공고 마감일 YYYYMMDD 원문. */
  noticeEdt: string;
}

export const SHELTER_TITLE_MAX = 60;

/** 목록에서 보호소 글인지. */
export const isShelterProduct = (p: { externalSource?: string | null } | null | undefined): boolean =>
  p?.externalSource === SHELTER_SOURCE;

/**
 * 보호소 전화번호 → tel: 링크. 숫자·하이픈만 남기고 7자리 미만이거나 번호가 없으면 null(E-6 — '공고 원문 보기'만 보인다).
 * 번호가 여러 개("031-1 / 031-2")면 첫 번호만 쓴다.
 */
export function shelterTelHref(tel: string | null | undefined): string | null {
  const first = String(tel ?? "").split(/[\/,;~]/)[0];
  const cleaned = first.replace(/[\s().]/g, "");
  if (!/^\+?[0-9-]+$/.test(cleaned)) return null;
  return cleaned.replace(/[^0-9]/g, "").length >= 7 ? `tel:${cleaned}` : null;
}

/** 사진 주소. http 로 오는 animal.go.kr 주소를 https 로 바꾼다. 없으면 null. */
export function shelterPhotoUrl(item: ShelterApiItem): string | null {
  const url = clean(item.popfile1);
  return url ? url.replace(/^http:\/\//i, "https://") : null;
}

// ── 문자열 도구 ──────────────────────────────────────────────────

const clean = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").replace(/—/g, "-").trim();

/** FNV-1a 32비트. 문장 틀을 공고번호로 고를 때만 쓴다(같은 입력 → 같은 틀). */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(list: readonly T[], seed: string, salt: string): T {
  return list[hash32(`${salt}:${seed}`) % list.length];
}

/** 마지막 글자에 받침이 있으면 true, 없으면 false, 한글이 아니면 null. */
function hasBatchim(word: string): boolean | null {
  const code = word.trim().charCodeAt(word.trim().length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return null;
  return (code - 0xac00) % 28 !== 0;
}

/** 이에요/예요. 한글이 아니면 이에요. */
const iyo = (word: string): string => (hasBatchim(word) === false ? `${word}예요` : `${word}이에요`);
const josa = (word: string, withBatchim: string, without: string): string =>
  `${word}${hasBatchim(word) === false ? without : withBatchim}`;

/** 20261024 → 10.24 */
const mmdd = (s: unknown): string => {
  const v = clean(s);
  return /^\d{8}$/.test(v) ? `${v.slice(4, 6)}.${v.slice(6, 8)}` : "";
};

const SEX_LABEL: Record<string, string> = { M: "남아", F: "여아" };
const SEX_ID: Record<string, NonNullable<PetInfo["sex"]>> = { M: "male", F: "female", Q: "unknown" };
const NOUN: Record<ShelterSpecies, string> = { 강아지: "유기견", 고양이: "유기묘" };
const FORBIDDEN_WORDS = /판매|구매|상품/;

/** "[개] 믹스견" → "믹스견". 품종이 '기타'거나 비면 강아지·고양이로 부른다. */
function breedOf(item: ShelterApiItem, species: ShelterSpecies): string {
  const breed = clean(item.kindNm ?? item.kindCd).replace(/^\[[^\]]+\]\s*/, "");
  return !breed || breed === "기타" || /^\d+$/.test(breed) ? species : breed;
}

/** "2024(년생)" → "2024년생", "2026(60일미만)(년생)" → "2026년생(60일 미만)". */
function ageOf(item: ShelterApiItem): string {
  const raw = clean(item.age);
  if (!raw) return "";
  const year = raw.match(/^(\d{4})/);
  if (year) return `${year[1]}년생${raw.includes("60일미만") ? "(60일 미만)" : ""}`;
  return raw.replace(/\(.*$/, "").trim();
}

// ── 동네 ────────────────────────────────────────────────────────

const SIDO_ALIASES: Record<string, string> = {
  강원도: "강원특별자치도",
  전라북도: "전북특별자치도",
  제주도: "제주특별자치도",
  세종시: "세종특별자치시",
};
const SHORT_TO_SIDO: Record<string, string> = Object.keys(SIDO_SHORT).reduce<Record<string, string>>((acc, sido) => {
  acc[SIDO_SHORT[sido]] = sido;
  return acc;
}, {});

function resolveSido(token: string): string | null {
  if (REGIONS.some((r) => r.sido === token)) return token;
  return SIDO_ALIASES[token] ?? SHORT_TO_SIDO[token] ?? null;
}

const stripAdmin = (name: string) => name.replace(/(특별자치시|특별자치도|광역시|특별시|시|군|구)$/, "");

export interface ShelterPlace {
  /** 제목·본문에 쓰는 짧은 이름: "화성", "서울", "광주". */
  city: string;
  regionSido: string | null;
  regionSigungu: string | null;
}

/**
 * 공고 관할 기관명(orgNm: "경기도 화성시", "서울특별시 강남구", "세종특별자치시") → 동네.
 * 2026-07 통합한 '전남광주통합특별시'는 아는 이름(광주)으로 쓰되, 뒤에 전남 시·군이 오면 그 시·군으로 본다.
 */
export function shelterPlaceOf(orgNm: string | null | undefined): ShelterPlace {
  const [first = "", second = ""] = clean(orgNm).split(" ");
  let sido = /^전남광주통합/.test(first) ? "광주광역시" : resolveSido(first);
  if (/^전남광주통합/.test(first) && second && REGIONS.find((r) => r.sido === "전라남도")!.sigungu.indexOf(second) >= 0) {
    sido = "전라남도";
  }
  const entry = sido ? REGIONS.find((r) => r.sido === sido) : undefined;
  let sigungu: string | null = null;
  if (entry) {
    if (entry.sigungu.length === 1 && entry.sigungu[0] === entry.sido) sigungu = entry.sido;
    else if (second && entry.sigungu.indexOf(second) >= 0) sigungu = second;
  }
  const metropolitan = !!sido && /(특별시|광역시|특별자치시)$/.test(sido);
  const raw = metropolitan && sido ? SIDO_SHORT[sido] : stripAdmin(sigungu && !metropolitan ? sigungu : second || first);
  return {
    city: raw || (sido ? SIDO_SHORT[sido] : "") || "전국",
    regionSido: sigungu ? sido : null,
    regionSigungu: sigungu,
  };
}

// ── 제목 ────────────────────────────────────────────────────────

interface TitleCtx {
  city: string;
  noun: string;
  who: string;
}

/** 시군구 · 품종(또는 종) · 성별 + 검색어(유기견/유기묘)가 모두 들어가는 제목 틀. */
const TITLE_TEMPLATES: ReadonlyArray<(c: TitleCtx) => string> = [
  (c) => `[${c.city} ${c.noun}] ${c.who}, 가족을 기다려요`,
  (c) => `${c.city} 보호소 ${c.noun} · ${c.who} 새 가족 찾아요`,
  (c) => `${c.city} ${c.noun} ${c.who}, 따뜻한 집을 기다려요`,
  (c) => `[${c.city} 보호소] ${c.noun} ${c.who} 평생 가족을 찾고 있어요`,
  (c) => `${c.who} ${c.noun} · ${c.city}에서 가족이 되어 주세요`,
  (c) => `${c.city}에서 만난 ${c.noun} ${c.who}, 입양 가족을 찾아요`,
  (c) => `${c.city} 보호소에서 기다리는 ${c.noun}, ${c.who}`,
  (c) => `[${c.city}] ${c.who} ${c.noun}, 새 가족이 되어 주실래요?`,
];

function buildTitle(ctx: TitleCtx, seed: string): string {
  const start = hash32(`title:${seed}`) % TITLE_TEMPLATES.length;
  for (let i = 0; i < TITLE_TEMPLATES.length; i += 1) {
    const title = TITLE_TEMPLATES[(start + i) % TITLE_TEMPLATES.length](ctx);
    if (title.length <= SHELTER_TITLE_MAX) return title;
  }
  return `${ctx.city} ${ctx.noun} ${ctx.who}`.slice(0, SHELTER_TITLE_MAX);
}

// ── 본문 ────────────────────────────────────────────────────────

interface IntroCtx {
  city: string;
  /** 동네가 이미 이름에 들어 있으면 그대로("화성시 동물보호센터"), 아니면 "화성의 OO보호소". */
  care: string;
  careAt: string;
  noun: string;
  who: string;
}

/** 첫 문단 틀. 모두 '무료입양'을 한 번만 자연스럽게 넣는다. */
const INTRO_TEMPLATES: ReadonlyArray<(c: IntroCtx) => string> = [
  (c) => `${c.careAt}에서 새 가족을 기다리고 있는 ${iyo(c.who)}. 무료입양으로 만날 수 있어요.`,
  (c) => `${c.care}에서 지내고 있는 ${c.noun} ${josa(c.who, "을", "를")} 소개해요. 무료입양으로 가족이 되어 줄 분을 찾고 있어요.`,
  (c) => `따뜻한 집이 필요한 ${josa(c.who, "이", "가")} ${c.careAt}에서 기다리고 있어요. 무료입양이라 부담 없이 문의해 볼 수 있어요.`,
  (c) => `${c.care}에서 보호하고 있는 ${iyo(c.who)}. 평생 함께할 가족을 찾고 있고, 무료입양으로 만날 수 있어요.`,
  (c) => `${c.noun} 입양을 생각하고 계신가요? ${c.care}에서 ${josa(c.who, "이", "가")} 새 가족을 기다려요. 무료입양으로 만날 수 있어요.`,
  (c) => `${josa(c.who, "이", "가")} ${c.care}에서 하루하루 가족을 기다리고 있어요. 무료입양으로 이 아이를 만나 보실래요?`,
];

const SPECIAL_SPLIT = /[\/,，、·・ㆍ;；\n\r]+/;
const MAX_TRAITS = 6;
const MAX_TRAIT_LENGTH = 70;

/** 단순한 끝맺음만 해요체로 바꾼다: 순함→순해요, 수컷임→수컷이에요, 있음→있어요. 나머지는 그대로. */
function rephraseTrait(fragment: string): string {
  const f = fragment;
  if (f.length > 1 && f.endsWith("함")) return `${f.slice(0, -1)}해요`;
  if (f.length > 1 && f.endsWith("임")) return iyo(f.slice(0, -1));
  if (f.endsWith("있음")) return `${f.slice(0, -2)}있어요`;
  if (f.endsWith("없음")) return `${f.slice(0, -2)}없어요`;
  return f;
}

/** 특이사항 원문 → 조각 목록. 구분자로 쪼개고, 목록 기호·끝 구두점을 지우고, 빈 조각·중복·금지어 조각을 뺀다. */
export function shelterTraits(specialMark: string | null | undefined): string[] {
  const seen: Record<string, true> = {};
  const traits: string[] = [];
  for (const piece of String(specialMark ?? "").replace(/\.\s+/g, "\n").split(SPECIAL_SPLIT)) {
    const text = clean(piece)
      .replace(/^(?:[-*•▶▷○●■□※]+|\d+[.)])\s*/, "")
      .replace(/[.。!]+$/, "")
      .trim();
    const key = text.replace(/\s+/g, "").toLowerCase();
    if (!text || seen[key] || FORBIDDEN_WORDS.test(text)) continue;
    seen[key] = true;
    traits.push(rephraseTrait(text.slice(0, MAX_TRAIT_LENGTH)));
    if (traits.length >= MAX_TRAITS) break;
  }
  return traits;
}

function buildDescription(item: ShelterApiItem, species: ShelterSpecies, seed: string, place: ShelterPlace, who: string): string {
  const care = clean(item.careNm) || "보호소";
  const careAt = care.indexOf(place.city) >= 0 ? care : `${place.city}의 ${care}`;
  const intro = pick(INTRO_TEMPLATES, seed, "intro")({ city: place.city, care, careAt, noun: NOUN[species], who });

  const age = ageOf(item);
  const neuter = item.neuterYn === "Y" ? "중성화 했어요" : item.neuterYn === "N" ? "중성화는 아직이에요" : null;
  const facts = [
    age ? `나이 ${age}` : null,
    clean(item.weight).replace("(Kg)", "kg") || null,
    clean(item.colorCd) || null,
    neuter,
  ]
    .filter(Boolean)
    .join(" · ");

  const traits = shelterTraits(item.specialMark);
  const happenPlace = clean(item.happenPlace);
  const start = mmdd(item.noticeSdt);
  const end = mmdd(item.noticeEdt);
  const careLine = [care, clean(item.careTel)].filter(Boolean).join(" ");
  const addr = clean(item.careAddr);

  const lines: Array<string | null> = [
    intro,
    "",
    facts || null,
    traits.length ? "" : null,
    traits.length ? "이런 아이예요" : null,
    ...traits.map((t) => `- ${t}`),
    happenPlace ? "" : null,
    happenPlace ? `발견 장소: ${happenPlace}` : null,
    start && end ? `공고 기간: ${start} ~ ${end}` : end ? `공고 마감: ${end}` : null,
    "",
    "입양 문의는 보호소로 해 주세요",
    careLine,
    addr || null,
    "",
    `출처: 국가동물보호정보시스템 공고 ${clean(item.noticeNo)}`,
    "보호 기간이 지나면 이미 입양됐거나 공고가 바뀌었을 수 있어요.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

// ── 공고 → 글 ───────────────────────────────────────────────────

/** 공고 한 건 → 입양 쪽 글. 사진이 없으면 photos 가 비어 있다(동기화가 그런 공고는 건너뛴다). */
export function toShelterProduct(item: ShelterApiItem, species: ShelterSpecies): ShelterProduct {
  const externalId = clean(item.desertionNo);
  const seed = externalId || clean(item.noticeNo);
  const breed = breedOf(item, species);
  const sex = SEX_LABEL[clean(item.sexCd)] ?? "";
  const who = `${breed}${sex ? ` ${sex}` : ""}`;
  const place = shelterPlaceOf(item.orgNm);
  const photo = shelterPhotoUrl(item);

  const petInfo: PetInfo = { sex: SEX_ID[clean(item.sexCd)] ?? "unknown", reason: "rescued" };
  const age = ageOf(item).slice(0, 20);
  if (age) petInfo.age = age;
  if (item.neuterYn === "Y") petInfo.health = ["neutered"];

  return {
    name: buildTitle({ city: place.city, noun: NOUN[species], who }, seed),
    description: buildDescription(item, species, seed, place, who),
    category: species,
    productType: "생물",
    dealType: "rehoming",
    petInfo,
    regionSido: place.regionSido,
    regionSigungu: place.regionSigungu,
    photos: photo ? [photo] : [],
    externalSource: SHELTER_SOURCE,
    externalId,
    noticeNo: clean(item.noticeNo),
    noticeEdt: clean(item.noticeEdt),
  };
}
