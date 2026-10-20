/**
 * 종별 사육 가이드 타입·주소·본문 검사(앱 docs/prd/species-guide.md §2.1·§5).
 * 앱 src/lib/guides.ts 와 같은 파일 사본이다. 바꾸면 두 곳을 같이 고치고
 * 웹 jest(__tests__/guides.test.ts)·앱 `npm run test:guides` 를 돌린다.
 */

export const GUIDE_GROUPS = ["곤충", "절지류", "파충류", "어류", "포유류", "양서류", "식물"] as const;
export type GuideGroup = (typeof GUIDE_GROUPS)[number];

/** 지정관리 야생동물(포유류·조류·파충류·양서류, 2025-12-14 시행)이 될 수 있는 분류. 신고 섹션 확인이 필수다. */
export const DESIGNATED_WILDLIFE_GROUPS: readonly GuideGroup[] = ["파충류", "양서류", "포유류"];

export const GUIDE_LEGAL_STATUSES = ["백색목록", "백색목록 외", "해당 없음"] as const;
export type GuideLegalStatus = (typeof GUIDE_LEGAL_STATUSES)[number];

export interface GuideSource {
  id: string;
  name: string;
  /** 이 출처에서 가져온 것(목록에 보조 글로 보인다). */
  usedFor: string;
  url?: string;
  /** YYYY-MM-DD */
  checkedAt: string;
}

/** 숫자가 든 사실. 출처 2곳 이상이거나, 한 곳·경험담이면 hedge 로 표시하고 문장에 '~라는 사람이 많아요'처럼 쓴다. */
export interface GuideFact {
  label: string;
  value: string;
  sub?: string;
  sources: string[];
  hedge?: boolean;
}

export interface GuideTable {
  columns: string[];
  rows: { cells: string[]; sub?: string; sources: string[]; hedge?: boolean }[];
}

export interface SpeciesGuide {
  slug: string;
  /** 분류표(categoryTaxonomy) 소분류 이름 */
  species: string;
  group: GuideGroup;
  status: "draft" | "published";
  title: string;
  /** 짧은 부름말(버튼 문구 "크레 키우면서 궁금한 거 물어보기"). 없으면 species */
  nickname?: string;
  intro: string;
  /** 머리 집계 줄 앞에 붙는 한 줄(국내 통계 등) */
  highlight?: GuideFact;
  updatedAt: string;
  photo?: { src: string; credit: string };
  overview: GuideFact[];
  fit: { good: string[]; rethink: string[] };
  supplies: { name: string; tip?: string }[];
  housing: { intro: string; sizeTable: GuideTable; cohab: string[]; substrate: string };
  climate: { rows: GuideFact[]; note?: string; seasons: { season: string; text: string }[] };
  feeding: { schedule: GuideTable; rules: string[]; memberTip?: { postId: number; author: string; quote: string } };
  routine: { period: string; items: { text: string; sub?: string }[] }[];
  symptoms: { symptom: string; causes: string; homeCare: string; vet: boolean }[];
  breeding: { rows: GuideFact[]; note?: string };
  morphs: { intro: string; patterns: string[]; traits: { name: string; inheritance: string; note: string }[] };
  legal: {
    status: GuideLegalStatus;
    /** 야생동물종합관리시스템에 올라간 법정 국명 */
    legalName?: string;
    intro: string;
    rows: GuideFact[];
    notes: string[];
    site?: { label: string; url: string };
    checkedAt: string;
  };
  faq: { q: string; a: string; postIds?: number[] }[];
  sources: GuideSource[];
}

/** 목차 칩 순서. 앱·웹 화면이 같은 id 로 섹션을 찾는다. */
export const GUIDE_SECTIONS = [
  { id: "overview", label: "한눈에" },
  { id: "supplies", label: "준비물" },
  { id: "housing", label: "사육장" },
  { id: "climate", label: "온도·습도" },
  { id: "feeding", label: "먹이" },
  { id: "routine", label: "관리" },
  { id: "symptoms", label: "건강" },
  { id: "breeding", label: "번식" },
  { id: "morphs", label: "모프" },
  { id: "legal", label: "신고" },
  { id: "faq", label: "질문" },
] as const;

/** 섹션 앵커 id(목차 칩이 찾는다) */
export const guideSectionDomId = (id: string) => `guide-${id}`;

/** 본문 검사 최소치(PRD AC-10) */
export const GUIDE_MINIMUMS = { overview: 6, fit: 2, supplies: 8, symptoms: 5, faq: 4, sources: 2 } as const;

export const toGuideSlug = (species: string) => species.trim().replace(/\s+/g, "-");
export const guideHref = (slug: string) => `/guide/${encodeURIComponent(slug)}`;
export const GUIDE_INDEX_HREF = "/guide";
export const guideAskHref = (species: string) =>
  `/posts/upload?category=${encodeURIComponent("질문")}&species=${encodeURIComponent(species)}`;

export interface GuideCommunityCounts {
  posts: number;
  products: number;
  auctions: number;
  bloodlines: number;
}

/** "브리디 회원 글 58개 · 분양 3 · 경매 1". 0인 항목은 뺀다. 다 0이면 null. */
export const guideCountsText = (counts: GuideCommunityCounts | null | undefined): string | null => {
  if (!counts) return null;
  const parts = [
    counts.posts > 0 ? `브리디 회원 글 ${counts.posts}개` : null,
    counts.products > 0 ? `분양 ${counts.products}` : null,
    counts.auctions > 0 ? `경매 ${counts.auctions}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

/* ------------------------------------------------------------------ */
/* API 응답(/api/guides, /api/guides/:slug)                             */
/* ------------------------------------------------------------------ */

export interface GuidePostItem {
  id: number;
  title: string;
  category: string | null;
  comments: number;
  likes: number;
  createdAt: string;
}

/** 프로필 '지금 분양 중'과 같은 모양(웹 pages/api/users/[id]/on-sale.ts OnSaleItem). 같은 카드로 그린다. */
export type GuideOnSaleItem =
  | { kind: "product"; id: number; name: string; price: number | null; photo: string | null; status: string; dealType: string; createdAt: string }
  | { kind: "auction"; id: number; title: string; currentPrice: number; startPrice: number; photo: string | null; endAt: string; bidCount: number; createdAt: string };

export interface GuideCommunity {
  counts: GuideCommunityCounts;
  posts: GuidePostItem[];
  onSale: GuideOnSaleItem[];
}

export interface GuideSummary {
  slug: string;
  species: string;
  group: GuideGroup;
  title: string;
  intro: string;
  /** 조회 실패면 null */
  counts: GuideCommunityCounts | null;
}

export interface GuideListResponse {
  success: true;
  groups: { group: GuideGroup; guides: GuideSummary[] }[];
}

export interface GuideDetailResponse {
  success: true;
  guide: SpeciesGuide;
  /** 회원 데이터 조회 실패면 null — 그 칸만 숨기고 본문은 보인다 */
  community: GuideCommunity | null;
  /** 같은 분류의 다른 공개 가이드 */
  related: { slug: string; species: string }[];
}

/** 분류표 순서로 묶고, 가이드가 없는 분류는 뺀다. */
export const groupGuides = <T extends { group: GuideGroup }>(guides: readonly T[]) =>
  GUIDE_GROUPS.map((group) => ({ group, guides: guides.filter((g) => g.group === group) })).filter(
    (row) => row.guides.length > 0
  );

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_DIGIT = /\d/;

/**
 * 가이드 본문 검사. 오류 문장 목록을 돌려준다(빈 배열이면 통과).
 * draft 는 형식만 보고, published 는 13섹션 분량·숫자 출처·신고 섹션까지 본다.
 */
export function validateGuide(
  guide: SpeciesGuide,
  taxonomy: readonly { name: string; children?: readonly string[] }[]
): string[] {
  const errors: string[] = [];
  const at = (msg: string) => errors.push(`${guide.slug || "(slug 없음)"}: ${msg}`);

  if (guide.slug !== toGuideSlug(guide.species)) at(`slug 는 '${toGuideSlug(guide.species)}' 여야 한다`);
  if (!GUIDE_GROUPS.includes(guide.group)) at(`분류 '${guide.group}' 없음`);
  const node = taxonomy.find((row) => row.name === guide.group);
  if (!node?.children?.includes(guide.species)) at(`'${guide.group}' 분류에 '${guide.species}' 없음`);
  if (guide.status !== "draft" && guide.status !== "published") at(`status '${guide.status}'`);
  if (!DATE.test(guide.updatedAt)) at("updatedAt 은 YYYY-MM-DD");

  const sourceIds = new Set(guide.sources.map((s) => s.id));
  for (const s of guide.sources) {
    if (!s.name || !s.usedFor) at(`출처 ${s.id} 이름·쓴 곳 없음`);
    if (!DATE.test(s.checkedAt)) at(`출처 ${s.id} checkedAt 은 YYYY-MM-DD`);
  }

  const facts: { where: string; text: string; sources: string[]; hedge?: boolean }[] = [];
  const addFact = (where: string, f: GuideFact) =>
    facts.push({ where, text: `${f.value} ${f.sub ?? ""}`, sources: f.sources, hedge: f.hedge });
  if (guide.highlight) addFact("머리", guide.highlight);
  guide.overview.forEach((f) => addFact(`한눈에 '${f.label}'`, f));
  guide.climate.rows.forEach((f) => addFact(`온도·습도 '${f.label}'`, f));
  guide.breeding.rows.forEach((f) => addFact(`번식 '${f.label}'`, f));
  guide.legal.rows.forEach((f) => addFact(`신고 '${f.label}'`, f));
  for (const [name, table] of [
    ["사육장 표", guide.housing.sizeTable],
    ["먹이 표", guide.feeding.schedule],
  ] as const) {
    table.rows.forEach((row, i) =>
      facts.push({ where: `${name} ${i + 1}행`, text: `${row.cells.join(" ")} ${row.sub ?? ""}`, sources: row.sources, hedge: row.hedge })
    );
  }
  for (const f of facts) {
    const unknown = f.sources.filter((id) => !sourceIds.has(id));
    if (unknown.length) at(`${f.where}: 모르는 출처 ${unknown.join(", ")}`);
  }

  if (guide.status !== "published") return errors;

  const min = GUIDE_MINIMUMS;
  if (!guide.title.trim() || !guide.intro.trim()) at("제목·소개 없음");
  if (guide.overview.length < min.overview) at(`한눈에 보기 ${guide.overview.length}줄(${min.overview} 이상)`);
  if (guide.fit.good.length < min.fit || guide.fit.rethink.length < min.fit) at(`맞는 사람·다시 생각할 사람 각 ${min.fit}줄 이상`);
  if (guide.supplies.length < min.supplies) at(`준비물 ${guide.supplies.length}개(${min.supplies} 이상)`);
  if (!guide.housing.sizeTable.rows.length || !guide.housing.cohab.length || !guide.housing.substrate.trim()) at("사육장 표·합사·바닥재 중 빈 칸");
  if (guide.climate.rows.length < 3) at("온도·습도 3줄 이상");
  const seasons = guide.climate.seasons.map((s) => s.season);
  if (!seasons.includes("여름") || !seasons.includes("겨울")) at("계절 칸에 여름·겨울이 있어야 한다");
  if (!guide.feeding.schedule.rows.length || guide.feeding.rules.length < 3) at("먹이 표 1행·규칙 3줄 이상");
  if (guide.routine.length < 3) at("관리 루틴 3구간 이상");
  if (guide.symptoms.length < min.symptoms) at(`증상 ${guide.symptoms.length}개(${min.symptoms} 이상)`);
  if (!guide.symptoms.some((s) => s.vet)) at("병원 표시 증상이 하나도 없다");
  if (guide.breeding.rows.length < 2) at("번식 2줄 이상");
  if (!guide.morphs.patterns.length && !guide.morphs.traits.length) at("모프·품종 없음");
  if (!guide.legal.rows.length || !DATE.test(guide.legal.checkedAt)) at("신고 섹션 행·확인 날짜 필요");
  if (DESIGNATED_WILDLIFE_GROUPS.includes(guide.group) && guide.legal.status === "해당 없음") {
    at(`${guide.group}는 지정관리 야생동물 여부(백색목록·백색목록 외)를 확인해 적는다`);
  }
  if (guide.legal.status !== "해당 없음" && !guide.legal.legalName) at("법정 국명(legalName) 필요");
  if (guide.faq.length < min.faq) at(`자주 묻는 질문 ${guide.faq.length}개(${min.faq} 이상)`);
  if (guide.sources.length < min.sources) at(`출처 ${guide.sources.length}곳(${min.sources} 이상)`);

  for (const f of facts) {
    if (HAS_DIGIT.test(f.text) && f.sources.length < 2 && !f.hedge) {
      at(`${f.where}: 숫자는 출처 2곳 이상이거나 hedge 표시`);
    }
  }
  return errors;
}
