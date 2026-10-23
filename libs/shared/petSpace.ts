/**
 * 강아지·고양이 공간(앱 docs/prd/pet-space.md, 2026-10-23 사용자 결정).
 * - 첫 질문 "어떤 아이를 키우시나요?" 카드 → 관심 분야 고정 path 묶음.
 * - 사이드 메뉴 공간 전환 = 고정 묶음(새 설정을 만들지 않는다).
 * - 강아지·고양이를 고정하면 분양 탭 위 전환에 '입양'이 붙는다(하단 탭은 그대로).
 * - 강아지·고양이 분양글은 가격을 받지도 저장하지도 않고, 종류(분양해요·가족 찾아요·임보 구해요)와
 *   성별·나이·건강·이유·임보 기간을 받는다(Product.petInfo).
 * 파충류·곤충·물고기만 고른 사람과 전체 보기는 지금 동작 그대로다.
 *
 * 앱 bredy_app src/lib/petSpace.ts = 웹 libs/shared/petSpace.ts 사본이라 함께 고친다.
 */

import { SIDO_SHORT } from "./regions";

// ── 첫 질문 카드 ────────────────────────────────────────────────

export type PetPickId =
  | "dog"
  | "cat"
  | "small"
  | "reptile"
  | "insect"
  | "fish"
  | "plant"
  | "etc"
  | "none";

/**
 * 브리디 2D 캐릭터 이름(시안 design/mockups/pet-space/assets/chibi-<art>.svg).
 * 웹 public/images/pets/chibi-<art>.svg, 앱 src/components/features/pet/PetCharacter.tsx 가 같은 그림이다.
 */
export type PetArt = "dog" | "cat" | "hamster" | "lizard" | "beetle" | "fish" | "plant" | "frog" | "eyes";

export interface PetPickCard {
  id: PetPickId;
  label: string;
  /** 카드 아래 작은 글씨. 없으면 비운다. */
  sub: string;
  /** 고정할 카테고리 path. 'none'(아직 없어요)은 비어 있다 = 전체 보기. */
  paths: readonly string[];
  art: PetArt;
}

const SMALL_MAMMAL_PATHS = [
  "/mammal/hamster/",
  "/mammal/guinea-pig/",
  "/mammal/rabbit/",
  "/mammal/hedgehog/",
  "/mammal/ferret/",
  "/mammal/chinchilla/",
] as const;

export const DOG_PATH = "/mammal/dog/";
export const CAT_PATH = "/mammal/cat/";
const MAMMAL_PATH = "/mammal/";

export const PET_PICK_CARDS: readonly PetPickCard[] = [
  { id: "dog", label: "강아지", sub: "", paths: [DOG_PATH], art: "dog" },
  { id: "cat", label: "고양이", sub: "", paths: [CAT_PATH], art: "cat" },
  { id: "small", label: "소동물", sub: "햄스터·기니피그·토끼·고슴도치", paths: SMALL_MAMMAL_PATHS, art: "hamster" },
  { id: "reptile", label: "파충류", sub: "게코·뱀·거북", paths: ["/reptile/"], art: "lizard" },
  // 타란튤라는 곤충이 아니라 절지류다(앱 분류 이름 '절지류'와 같게, 2026-10-23 페르소나 리뷰).
  { id: "insect", label: "곤충·절지류", sub: "사슴벌레·장수풍뎅이·타란튤라", paths: ["/insect/", "/arthropod/"], art: "beetle" },
  // 어항을 하는 사람은 수초도 같이 본다(수초는 분류상 식물 > 수초).
  { id: "fish", label: "물고기", sub: "구피·베타·수초", paths: ["/fish/", "/plant/aquatic-plant/"], art: "fish" },
  // 식물은 '양서류·기타' 안에 있다가 따로 나왔다(2026-10-23 페르소나 리뷰 — 식물 키우는 50대가 첫 화면에서 못 찾았다).
  { id: "plant", label: "식물", sub: "관엽·다육·식충식물", paths: ["/plant/"], art: "plant" },
  { id: "etc", label: "양서류·기타", sub: "엑솔로틀·개구리", paths: ["/amphibian/", "/etc/"], art: "frog" },
  { id: "none", label: "아직 없어요", sub: "다 둘러볼래요", paths: [], art: "eyes" },
];

/** 2열 카드 8장. '아직 없어요'는 그 아래 넓은 줄 하나로 따로 그린다(식물 카드가 생겨 9장이 됐다). */
export const PET_PICK_GRID_CARDS: readonly PetPickCard[] = PET_PICK_CARDS.filter((card) => card.id !== "none");
export const PET_PICK_NONE_CARD: PetPickCard = PET_PICK_CARDS.find((card) => card.id === "none")!;

/** 카드를 하나 눌렀을 때 다음 선택. '아직 없어요'는 다른 카드와 함께 고를 수 없다. */
export function togglePetPick(selected: readonly PetPickId[], id: PetPickId): PetPickId[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (id === "none") return ["none"];
  return [...selected.filter((item) => item !== "none"), id];
}

/**
 * 고른 카드 → 고정 path 목록(중복 없이). 강아지·고양이·소동물을 모두 고르면 '/mammal/' 하나로 줄인다.
 * 다른 path 아래에 드는 path 는 뺀다(물고기 '식물 > 수초' + 식물 → '식물'만).
 * '아직 없어요'만 골랐거나 아무것도 안 골랐으면 [] (전체 보기).
 */
export function pathsForPetPicks(selected: readonly PetPickId[]): string[] {
  const ids = new Set(selected);
  const allMammal = ids.has("dog") && ids.has("cat") && ids.has("small");
  const out: string[] = [];
  for (const card of PET_PICK_CARDS) {
    if (!ids.has(card.id)) continue;
    if (allMammal && (card.id === "dog" || card.id === "cat" || card.id === "small")) continue;
    out.push(...card.paths);
  }
  if (allMammal) out.unshift(MAMMAL_PATH);
  const unique = Array.from(new Set(out));
  return unique.filter((path) => !unique.some((other) => other !== path && path.startsWith(other)));
}

/** 지금 고정 path → 해당하는 카드(공간 시트·온보딩 다시 열기에서 미리 고른 상태). */
export function petPicksForPaths(paths: readonly string[]): PetPickId[] {
  if (!paths.length) return [];
  const set = new Set(paths);
  const has = (p: string) => set.has(p);
  const picks: PetPickId[] = [];
  for (const card of PET_PICK_CARDS) {
    if (card.id === "none") continue;
    const coveredByMammal = has(MAMMAL_PATH) && card.paths.every((p) => p.startsWith(MAMMAL_PATH));
    if (coveredByMammal || (card.paths.length && card.paths.some(has))) picks.push(card.id);
  }
  return picks;
}

// ── 공간 ───────────────────────────────────────────────────────

export type PetSpaceId = "dogcat" | "exotic" | "all";

export interface PetSpace {
  id: PetSpaceId;
  label: string;
  sub: string;
  picks: readonly PetPickId[];
  art: PetArt;
}

export const PET_SPACES: readonly PetSpace[] = [
  { id: "dogcat", label: "강아지·고양이", sub: "분양 · 입양 · 임보", picks: ["dog", "cat"], art: "dog" },
  {
    id: "exotic",
    label: "소동물·파충류·곤충·물고기·식물",
    sub: "분양 · 경매 · 혈통",
    // 고정 path 묶음은 식물 카드가 생기기 전과 같다(옛 '양서류·기타'에 식물이 들어 있었다) — 이미 이 공간인 사람은 그대로 이 공간이다.
    picks: ["small", "reptile", "insect", "fish", "plant", "etc"],
    art: "lizard",
  },
  { id: "all", label: "전부 보기", sub: "모든 아이들", picks: [], art: "eyes" },
];

/**
 * 사이드 메뉴 '지금 공간' 이름. 공간과 같으면 그 이름, 첫 질문 카드로 고른 묶음이면 카드 이름(두 개까지, 넘으면 '외 N'),
 * 설정에서 종 단위로 골랐으면 '내가 고른 분야'. 2026-10-23 브라우저 테스트 — 강아지만 고른 사람이 '내가 고른 분야'로 보였다.
 */
export function petSpaceLabel(paths: readonly string[]): string {
  const id = petSpaceForPaths(paths);
  const space = PET_SPACES.find((item) => item.id === id);
  if (space) return space.label;
  const picks = petPicksForPaths(paths);
  const key = (list: readonly string[]) => [...list].sort().join(",");
  if (!picks.length || key(pathsForPetPicks(picks)) !== key(paths)) return CUSTOM_SPACE_LABEL;
  const names = picks.map((pick) => PET_PICK_CARDS.find((card) => card.id === pick)?.label ?? "");
  return names.length > 2 ? `${names.slice(0, 2).join("·")} 외 ${names.length - 2}` : names.join("·");
}

/** 고정 path 가 어느 공간과 똑같은지. 직접 섞어 골랐으면 null('내가 고른 분야'). */
export function petSpaceForPaths(paths: readonly string[]): PetSpaceId | null {
  const key = (list: readonly string[]) => [...list].sort().join(",");
  const current = key(paths);
  for (const space of PET_SPACES) {
    if (key(pathsForPetPicks(space.picks)) === current) return space.id;
  }
  return null;
}

export const CUSTOM_SPACE_LABEL = "내가 고른 분야";

/**
 * 공간 이름을 '·' 뒤에서만 접히게 나눈다('소동물·', '파충류·', …, '식물'). 사이드 메뉴 '지금 공간' 카드가 좁아
 * '소동물·파충류·곤충·물고기·식물'이 한 줄에 다 안 들어간다 — 말을 자르지 않고 두 줄로 접는다.
 */
export const spaceLabelParts = (label: string): string[] =>
  label.split("·").map((part, index, all) => (index < all.length - 1 ? `${part}·` : part));

// ── 홈 '다른 아이들 소식' ────────────────────────────────────────

export const OTHER_PETS_FEED_TITLE = "다른 아이들 소식";

/**
 * 홈 피드 아래 '다른 아이들 소식'(docs/prd/pet-space.md §5.7, 2026-10-23 페르소나 리뷰 — 강아지만 고르면 첫날 홈이
 * 빈다). 관심 분야를 고정했고 '전체' 칩·전체 종에서 고정 범위 글을 끝까지 받았을 때만 범위 밖 게시글을 이어 보인다.
 * 분양글은 섞지 않는다(다른 종 가격표가 강아지·고양이 사람 홈에 끼지 않게).
 */
export function showsOtherPetsFeed(input: {
  categoryPath: string | null | undefined;
  allChip: boolean;
  allSpecies: boolean;
  scopedDone: boolean;
}): boolean {
  return Boolean(input.categoryPath) && input.allChip && input.allSpecies && input.scopedDone;
}

/** 섹션 제목 아래 한 줄. 고정 범위 글이 하나도 없었으면 다르게 말한다. */
export const otherPetsFeedSub = (scopedEmpty: boolean) =>
  scopedEmpty
    ? "고른 분야 글이 올라오는 동안 다른 아이들 이야기를 둘러보세요."
    : "고른 분야 글은 다 봤어요. 다른 아이들 이야기도 둘러보세요.";

// ── 분양 탭 위 전환 ─────────────────────────────────────────────

/** 강아지·고양이(또는 포유류 전체)를 고정했는지. 입양 쪽을 보일지 정한다. */
export function hasDogCatPin(paths: readonly string[]): boolean {
  return paths.some(
    (path) => path === MAMMAL_PATH || path.startsWith(DOG_PATH) || path.startsWith(CAT_PATH)
  );
}

/** 강아지·고양이 아래만 고정했는지. 분양 쪽에서 가격 칩·무료 분양 섹션을 뺀다(가격이 없는 글뿐이라). */
export function isDogCatOnly(paths: readonly string[]): boolean {
  return paths.length > 0 && paths.every((path) => path.startsWith(DOG_PATH) || path.startsWith(CAT_PATH));
}

/**
 * 입양 쪽 목록 범위(categoryPath): 고정 중 강아지·고양이 아래만. 포유류 전체·고정 없음이면 강아지·고양이 둘 다.
 * 늘 강아지·고양이 안에서만 찾아 다른 종의 옛 '가족 찾아요'(rehoming) 글이 섞이지 않게 한다.
 */
export function adoptionScopePaths(paths: readonly string[]): string[] {
  const inside = paths.filter((path) => path.startsWith(DOG_PATH) || path.startsWith(CAT_PATH));
  return inside.length ? Array.from(new Set(inside)) : [DOG_PATH, CAT_PATH];
}

/**
 * 입양 쪽 글쓰기 링크에 미리 고를 종(?category=). 강아지·고양이 칩을 골랐거나 범위가 한 종뿐이면 그 종, 둘 다면 null
 * (글쓰기에서 고른다). 2026-10-23 브라우저 테스트 — 강아지만 고른 사람도 글쓰기에서 '포유류'부터 다시 골라야 했다.
 */
export function adoptionWriteSpecies(scopePaths: readonly string[], chip?: string | null): "강아지" | "고양이" | null {
  if (chip === "dog") return "강아지";
  if (chip === "cat") return "고양이";
  const dog = scopePaths.some((path) => path.startsWith(DOG_PATH));
  const cat = scopePaths.some((path) => path.startsWith(CAT_PATH));
  if (dog && !cat) return "강아지";
  if (cat && !dog) return "고양이";
  return null;
}

export type SaleTabMode = "products" | "auctions" | "adoption";

/**
 * 분양 탭 위 전환 칸. 1칸이면 전환 줄을 그리지 않는다.
 * - 강아지·고양이 + 포유류만: 분양 | 입양
 * - 강아지·고양이 + 다른 분야: 분양 | 경매 | 입양
 * - 포유류만(소동물만): 분양 (지금처럼 전환 없음)
 * - 그 밖(파충류 쪽·전체 보기): 분양 | 경매 (지금 그대로)
 */
export function saleTabModes(paths: readonly string[]): SaleTabMode[] {
  const mammalOnly = paths.length > 0 && paths.every((path) => path.startsWith(MAMMAL_PATH));
  const adoption = hasDogCatPin(paths);
  const modes: SaleTabMode[] = ["products"];
  if (!mammalOnly) modes.push("auctions");
  if (adoption) modes.push("adoption");
  return modes;
}

/**
 * 전환 칸에 지금 보고 있는 입양 쪽을 붙인다. 강아지·고양이를 고정하지 않은 사람이 공유 링크로 입양 쪽을 열면 칸에 '입양'이 없어
 * 아무 칸도 골라지지 않은 채 보였다(2026-10-23 브라우저 테스트). 다른 쪽으로 옮기면 다시 없어진다.
 */
export function saleTabModesShowing(paths: readonly string[], showing: SaleTabMode): SaleTabMode[] {
  const modes = saleTabModes(paths);
  return showing === "adoption" && !modes.includes("adoption") ? [...modes, "adoption"] : modes;
}

export const SALE_TAB_MODE_LABELS: Record<SaleTabMode, string> = {
  products: "분양",
  auctions: "경매",
  adoption: "입양",
};

/** 분양 쪽 종 칩 하나. category·subcategory 는 분양 목록 필터 값(대분류 이름·종 이름, 대분류 칩이면 subcategory "")이다. */
export interface SaleSpeciesChip {
  id: string;
  label: string;
  category: string;
  subcategory: string;
}

/** 한 대분류 아래 종 칩을 펼칠 최대 개수. 넘으면 대분류 칩 하나 + 아래 종 줄이다(소동물 카드 6종 → '포유류', 지금 분양 탭과 같게). */
const SPECIES_CHIPS_MAX = 3;

type ScopePin = { name: string; path: string; label: string };
const pinsUnder = (top: string, pins: readonly ScopePin[]) => pins.filter((pin) => pin.label.split(" > ")[0] === top);
const isSpeciesPin = (pin: ScopePin) => pin.path.split("/").filter(Boolean).length >= 2;

/**
 * 분양 쪽 종 칩(시안 ② '전체 · 강아지 · 고양이', ④ '전체 · 크레스티드 게코 · 강아지'). '전체' 칩은 부르는 쪽이 앞에 둔다.
 * 대분류 아래 종만 3개까지 고정했으면 대분류 칩('포유류') 대신 고정한 종을 칩으로 보이고, 대분류를 통째로 고정했거나
 * 종이 더 많거나 고정이 없으면 대분류 칩 그대로다(그때만 아래 종 줄이 열린다, saleSubcategoryNames). 2026-10-23 브라우저 테스트 —
 * 강아지만 고른 사람에게 '포유류' 칩이 보였다(첫 질문 카드에서도 '포유류'라는 말을 쓰지 않는다).
 */
export function saleSpeciesChips(topLevelNames: readonly string[], pins: readonly ScopePin[]): SaleSpeciesChip[] {
  const chips: SaleSpeciesChip[] = [];
  for (const top of topLevelNames) {
    const under = pinsUnder(top, pins);
    const species = under.filter(isSpeciesPin);
    if (!under.length || species.length < under.length || species.length > SPECIES_CHIPS_MAX) {
      chips.push({ id: top, label: top, category: top, subcategory: "" });
      continue;
    }
    for (const pin of species) {
      chips.push({ id: `${top}/${pin.name}`, label: pin.name, category: top, subcategory: pin.name });
    }
  }
  return chips;
}

/**
 * 대분류 칩을 골랐을 때 아래 종 줄. 대분류를 통째로 고정했거나 고정이 없으면 그 대분류의 종 전부(지금 그대로),
 * 종만 골라 고정했으면 고른 종만 — 소동물 카드로 고른 사람에게 범위 밖이라 늘 비는 '강아지·고양이' 칩을 보이지 않는다.
 */
export function saleSubcategoryNames(top: string, allSubcategories: readonly string[], pins: readonly ScopePin[]): string[] {
  const under = pinsUnder(top, pins);
  if (!under.length || !under.every(isSpeciesPin)) return [...allSubcategories];
  const picked = new Set(under.map((pin) => pin.name));
  return allSubcategories.filter((name) => picked.has(name));
}

// ── 강아지·고양이 분양글 ────────────────────────────────────────

/** 가격을 받지 않는 분양글 카테고리(Product.category 이름). */
export const NO_PRICE_CATEGORIES = ["강아지", "고양이"] as const;

export const isNoPriceCategory = (category: string | null | undefined): boolean =>
  !!category && (NO_PRICE_CATEGORIES as readonly string[]).includes(category);

/**
 * 강아지·고양이 글 종류 → Product.dealType. 안내는 뜻 → 보이는 곳 순서다
 * (2026-10-23 페르소나 리뷰: 어디에 보이는지만으론 무엇을 골라야 할지 모른다).
 */
export const PET_POST_KINDS = [
  { id: "adoption", label: "분양해요", hint: "우리 집에서 태어난 아이를 보내요. '분양' 쪽에 보여요." },
  { id: "rehoming", label: "가족 찾아요", hint: "구조했거나 키우던 아이의 새 가족을 찾아요. '입양' 쪽에 보여요." },
  {
    id: "foster",
    label: "임보 구해요",
    hint: "가족을 찾을 때까지 잠시 맡아 줄 분(임시보호)을 찾아요. '입양' 쪽 맨 위에 보여요.",
  },
] as const;
export type PetPostKind = (typeof PET_POST_KINDS)[number]["id"];

export const isPetPostKind = (value: unknown): value is PetPostKind =>
  PET_POST_KINDS.some((kind) => kind.id === value);

/** '입양' 쪽에 모이는 dealType. 서버 목록 dealGroup=adoption 이 이 값만 고른다. */
export const ADOPTION_SIDE_DEAL_TYPES = ["rehoming", "foster"] as const;

export const petPostKindLabel = (dealType: string | null | undefined): string | null =>
  PET_POST_KINDS.find((kind) => kind.id === dealType)?.label ?? null;

/** 가격 자리 문구. 강아지·고양이 글은 가격 대신 글 종류('분양해요' 등), 다른 글은 null(가격을 그대로 쓴다). */
export function petPriceStandIn(product: {
  category?: string | null;
  dealType?: string | null;
}): string | null {
  if (!isNoPriceCategory(product.category)) return null;
  return petPostKindLabel(product.dealType) ?? PET_POST_KINDS[0].label;
}

/**
 * 글쓰기 화면 제목·등록 버튼. 임보·가족 찾기 글은 '분양'이라 부르지 않는다(2026-10-23 브라우저 테스트 — 임보 글에 '분양 등록하기').
 * 강아지·고양이를 고르기 전(입양 쪽에서 들어와 종을 기다릴 때)도 들어온 글 종류를 따른다. 다른 글은 그대로다.
 */
export function productWriteLabels(petKind: PetPostKind | null): { title: string; submit: string } {
  if (petKind === "foster" || petKind === "rehoming") return { title: "글쓰기", submit: "글 올리기" };
  return { title: "분양 등록", submit: "분양 등록하기" };
}

/**
 * 강아지·고양이 글 설명 칸 안내. 가족 찾아요·임보 구해요는 입양·임보 조건을 적게 이끈다
 * (2026-10-23 페르소나 리뷰 — 조건 없이 보내는 게 불안하다). 고양이는 방묘창을 예로 더한다.
 */
export function petDescriptionPlaceholder(kind: PetPostKind, category?: string | null): string {
  if (kind === "rehoming") {
    const terms = category === "고양이" ? "중성화 약속·방묘창·근황 공유 등" : "중성화 약속·근황 공유 등";
    return `성격, 건강 상태와 입양 조건(${terms})을 적어 주세요.`;
  }
  if (kind === "foster") return "성격, 건강 상태와 임보 조건(지원 범위·근황 공유 등)을 적어 주세요.";
  return "성격, 건강 상태, 먹고 있는 사료, 함께 지낼 때 알아 둘 점을 적어 주세요.";
}

export const PET_SEX_OPTIONS = [
  { id: "male", label: "남아" },
  { id: "female", label: "여아" },
  { id: "unknown", label: "몰라요" },
] as const;
export const PET_HEALTH_OPTIONS = [
  { id: "vaccinating", label: "접종 중" },
  { id: "vaccinated", label: "접종 완료" },
  { id: "neutered", label: "중성화" },
  { id: "dewormed", label: "구충" },
] as const;
/** 우리 집에서 태어난 새끼는 '분양해요'라 이유에 두지 않는다(2026-10-23 페르소나 리뷰 — 두 종류가 겹쳤다). */
export const PET_REASON_OPTIONS = [
  { id: "rescued", label: "구조했어요" },
  { id: "circumstances", label: "사정이 생겼어요" },
  { id: "other", label: "기타" },
] as const;
export const FOSTER_PERIOD_OPTIONS = [
  { id: "2w", label: "2주" },
  { id: "1m", label: "한 달" },
  { id: "date", label: "날짜까지" },
  { id: "open", label: "가족 찾을 때까지" },
] as const;
export const FOSTER_SUPPORT_OPTIONS = [
  { id: "food", label: "사료" },
  { id: "vet", label: "병원비" },
  { id: "supplies", label: "용품" },
] as const;

type OptionId<T extends readonly { id: string }[]> = T[number]["id"];

export interface PetInfo {
  sex?: OptionId<typeof PET_SEX_OPTIONS>;
  /** '3개월', '2살 추정' 처럼 짧은 글. */
  age?: string;
  health?: OptionId<typeof PET_HEALTH_OPTIONS>[];
  reason?: OptionId<typeof PET_REASON_OPTIONS>;
  fosterPeriod?: OptionId<typeof FOSTER_PERIOD_OPTIONS>;
  /** fosterPeriod 가 'date' 일 때 'YYYY-MM-DD'. */
  fosterUntil?: string;
  fosterSupport?: OptionId<typeof FOSTER_SUPPORT_OPTIONS>[];
}

export const PET_AGE_MAX_LENGTH = 20;

const pickId = <T extends readonly { id: string }[]>(options: T, value: unknown) =>
  options.some((option) => option.id === value) ? (value as OptionId<T>) : undefined;

const pickIds = <T extends readonly { id: string }[]>(options: T, value: unknown) =>
  Array.isArray(value)
    ? (options.filter((option) => value.includes(option.id)).map((option) => option.id) as OptionId<T>[])
    : undefined;

/**
 * 요청 값 → PetInfo. 모르는 키·값은 버린다(형식이 틀려도 글쓰기를 막지 않는다).
 * 객체가 아니거나 남은 값이 없으면 null.
 */
export function parsePetInfo(raw: unknown): PetInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const info: PetInfo = {};
  const sex = pickId(PET_SEX_OPTIONS, input.sex);
  if (sex) info.sex = sex;
  if (typeof input.age === "string" && input.age.trim()) {
    info.age = input.age.trim().slice(0, PET_AGE_MAX_LENGTH);
  }
  const health = pickIds(PET_HEALTH_OPTIONS, input.health);
  if (health?.length) info.health = health;
  const reason = pickId(PET_REASON_OPTIONS, input.reason);
  if (reason) info.reason = reason;
  const fosterPeriod = pickId(FOSTER_PERIOD_OPTIONS, input.fosterPeriod);
  if (fosterPeriod) info.fosterPeriod = fosterPeriod;
  if (
    fosterPeriod === "date" &&
    typeof input.fosterUntil === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.fosterUntil)
  ) {
    info.fosterUntil = input.fosterUntil;
  }
  const support = pickIds(FOSTER_SUPPORT_OPTIONS, input.fosterSupport);
  if (support?.length) info.fosterSupport = support;
  return Object.keys(info).length ? info : null;
}

const labelOf = (options: readonly { id: string; label: string }[], id: string | undefined) =>
  options.find((option) => option.id === id)?.label;

/** 임보 기간 딱지: '2주' · '11월 30일까지' · '가족 찾을 때까지'. 없으면 null. */
export function fosterPeriodLabel(info: PetInfo | null | undefined): string | null {
  if (!info?.fosterPeriod) return null;
  if (info.fosterPeriod === "date") {
    const match = info.fosterUntil?.match(/^\d{4}-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}월 ${Number(match[2])}일까지` : null;
  }
  return labelOf(FOSTER_PERIOD_OPTIONS, info.fosterPeriod) ?? null;
}

export interface PetFact {
  label: string;
  /** 건강 칩은 초록으로 보인다. */
  good: boolean;
}

/** 목록 행 정보 칩: 성별 · 나이 · 건강(초록). '몰라요' 성별은 뺀다. */
export function petFacts(info: PetInfo | null | undefined): PetFact[] {
  if (!info) return [];
  const facts: PetFact[] = [];
  if (info.sex && info.sex !== "unknown") facts.push({ label: labelOf(PET_SEX_OPTIONS, info.sex)!, good: false });
  if (info.age) facts.push({ label: info.age, good: false });
  for (const id of info.health ?? []) facts.push({ label: labelOf(PET_HEALTH_OPTIONS, id)!, good: true });
  return facts;
}

export const petReasonLabel = (info: PetInfo | null | undefined) =>
  labelOf(PET_REASON_OPTIONS, info?.reason) ?? null;

/**
 * 썸네일 딱지용 짧은 임보 기간: 2주 · 한 달 · 11.30까지 · 입양까지. 목록 썸네일(120) 안에 '임보 · ' 와 같이 들어가게
 * 줄였다(2026-10-23 브라우저 테스트 — '임보 · 가족 찾을 …'처럼 잘렸다). 레일 카드·상세는 fosterPeriodLabel 그대로.
 */
export function fosterPeriodShortLabel(info: PetInfo | null | undefined): string | null {
  if (!info?.fosterPeriod) return null;
  if (info.fosterPeriod === "date") {
    const match = info.fosterUntil?.match(/^\d{4}-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}.${Number(match[2])}까지` : null;
  }
  if (info.fosterPeriod === "open") return "입양까지";
  return labelOf(FOSTER_PERIOD_OPTIONS, info.fosterPeriod) ?? null;
}

/**
 * 목록 썸네일 왼쪽 위 딱지(시안 ③ '구조했어요'): 가족 찾아요는 보내는 이유, 임보 구해요는 '임보 · 2주'.
 * 이유가 '기타'면 딱지를 두지 않는다(사진 위 '기타'는 아무것도 알려 주지 않는다). 분양해요·다른 종은 null.
 */
export function petThumbTag(product: {
  category?: string | null;
  dealType?: string | null;
  petInfo?: unknown;
}): string | null {
  if (!isNoPriceCategory(product.category)) return null;
  const info = parsePetInfo(product.petInfo);
  if (product.dealType === "rehoming") return info?.reason === "other" ? null : petReasonLabel(info);
  if (product.dealType === "foster") {
    const period = fosterPeriodShortLabel(info);
    return period ? `임보 · ${period}` : "임보";
  }
  return null;
}

// ── 가족 찾아요·임보 구해요 글 동네 ──────────────────────────────
// 2026-10-23 페르소나 리뷰(캣맘·강아지 키우는 20대): 어디 사는 아이인지 몰라 연락을 망설인다.
// 글을 올릴 때 작성자 프로필 동네(시·군·구)를 Product.regionSido·regionSigungu 에 복사한다('동네' 게시글과 같은 방식).
// 동네를 설정한 사람에게만 글쓰기 '내 동네 보이기' 스위치(기본 켬)가 보이고, 끄면 남기지 않는다. 분양해요 글엔 없다.

/** 동네를 남길 수 있는 글 종류: 가족 찾아요·임보 구해요(만나서 데려가는 글). */
export const showsPetRegion = (dealType: string | null | undefined): boolean =>
  dealType === "rehoming" || dealType === "foster";

/**
 * 글쓰기 스위치·상세 표의 동네 한 줄: "서울 마포구", "경기 성남시", 세종은 "세종". 시·군·구까지 있어야 하고 없으면 null.
 * 구 이름만으로는 겹쳐서(중구·강서구) 시·도 축약을 앞에 붙인다.
 */
export function petRegionText(
  region: { sido?: string | null; sigungu?: string | null } | null | undefined
): string | null {
  const sido = region?.sido?.trim();
  const sigungu = region?.sigungu?.trim();
  if (!sido || !sigungu) return null;
  const short = SIDO_SHORT[sido] ?? sido;
  return sigungu === sido ? short : `${short} ${sigungu}`;
}

/**
 * 목록 메타·임보 레일의 동네: 시·군·구만("마포구", 세종은 "세종", 시안 ③ '해피맘 · 마포구 · 2시간 전').
 * 강아지·고양이 가족 찾아요·임보 구해요 글에 동네가 남아 있을 때만, 아니면 null(그 자리엔 카테고리가 그대로 보인다).
 */
export function petPostPlace(product: {
  category?: string | null;
  dealType?: string | null;
  regionSido?: string | null;
  regionSigungu?: string | null;
}): string | null {
  if (!isNoPriceCategory(product.category) || !showsPetRegion(product.dealType)) return null;
  const sido = product.regionSido?.trim();
  const sigungu = product.regionSigungu?.trim();
  if (!sido || !sigungu) return null;
  return sigungu === sido ? SIDO_SHORT[sido] ?? sido : sigungu;
}

export interface PetInfoRow {
  label: string;
  value: string;
}

/**
 * 상세 정보 표: 성별 · 나이 · 건강 · (가족 찾아요) 보내는 이유 · (임보 구해요) 임보 기간 · 지원 · 동네. 빈 값은 뺀다.
 * 글 종류와 맞지 않는 값(분양해요 글의 임보 기간·동네 등)은 보이지 않는다. 동네는 "서울 마포구"(petRegionText).
 */
export function petInfoRows(
  info: PetInfo | null | undefined,
  dealType: string | null | undefined,
  region?: { sido?: string | null; sigungu?: string | null } | null
): PetInfoRow[] {
  const rows: PetInfoRow[] = [];
  if (info) {
    const sex = labelOf(PET_SEX_OPTIONS, info.sex);
    if (sex) rows.push({ label: "성별", value: sex });
    if (info.age) rows.push({ label: "나이", value: info.age });
    const health = (info.health ?? []).map((id) => labelOf(PET_HEALTH_OPTIONS, id)!);
    if (health.length) rows.push({ label: "건강", value: health.join(" · ") });
    if (dealType === "rehoming") {
      const reason = petReasonLabel(info);
      if (reason) rows.push({ label: "보내는 이유", value: reason });
    }
    if (dealType === "foster") {
      const period = fosterPeriodLabel(info);
      if (period) rows.push({ label: "임보 기간", value: period });
      const support = (info.fosterSupport ?? []).map((id) => labelOf(FOSTER_SUPPORT_OPTIONS, id)!);
      if (support.length) rows.push({ label: "지원", value: support.join(" · ") });
    }
  }
  const place = showsPetRegion(dealType) ? petRegionText(region) : null;
  if (place) rows.push({ label: "동네", value: place });
  return rows;
}

/** 임보 지원 한 줄: '사료·병원비 지원'. 없으면 null. */
export function fosterSupportLabel(info: PetInfo | null | undefined): string | null {
  const labels = (info?.fosterSupport ?? []).map((id) => labelOf(FOSTER_SUPPORT_OPTIONS, id)!);
  return labels.length ? `${labels.join("·")} 지원` : null;
}
