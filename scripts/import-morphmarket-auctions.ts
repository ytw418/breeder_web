#!/usr/bin/env node

import { setTimeout as delay } from "node:timers/promises";
import client from "@libs/server/client";
import {
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MAX_ACTIVE_PER_USER,
  AUCTION_MIN_START_PRICE,
  AUCTION_MIN_DURATION_MS,
  AUCTION_MAX_DURATION_MS,
  getBidIncrement,
} from "@libs/auctionRules";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

interface MorphmarketListing {
  key?: unknown;
  title?: unknown;
  description?: unknown;
  price?: unknown;
  usd_price?: unknown;
  price_currency?: unknown;
  original_price?: unknown;
  inquire_for_price?: unknown;
  thumb_image?: unknown;
  share_link?: unknown;
  category_name?: unknown;
  category_scientific_name?: unknown;
  sex?: unknown;
  maturity?: unknown;
  shipping_type?: unknown;
  min_shipping?: unknown;
  max_shipping?: unknown;
}

interface ImportRow {
  sourceKey: string;
  title: string;
  description: string;
  startPrice: number;
  endAt: Date;
  photos: string[];
  sourceUrl: string;
}

interface ImportLog {
  sourceKey: string;
  title: string;
  reason: string;
}

interface ImportedAuctionResult {
  totalCandidates: number;
  skippedByQuery: number;
  skippedByValidation: number;
  created: number;
  failed: number;
  createdAuctionIds: number[];
  skippedRows: ImportLog[];
}

const DEFAULT_MORPHMARKET_CATEGORY = "cgs";
const DEFAULT_MORPHMARKET_REGION = "us";
const DEFAULT_AUCTION_DURATION_HOURS = 24;
const DEFAULT_MORPH_EXCHANGE_RATE = 1_350;
const DEFAULT_MAX_ITEMS = 12;
const MAX_PHOTOS_PER_AUCTION = 3;

interface CliOptions {
  userId: number;
  maxPages: number;
  pageSize: number;
  maxItems: number;
  durationHours: number;
  includeInquirePrice: boolean;
  dryRun: boolean;
  category: string;
  region: string;
  state: string;
  morphExchangeRate: number;
  delayMs: number;
  maxStartPrice: number | null;
  search: string;
  translateToKorean: boolean;
}

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const asString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const KR_TRANSLATE_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bball python\b/gi, replacement: "볼 파이톤" },
  { pattern: /\bcrested gecko\b/gi, replacement: "크레스티드 게코" },
  { pattern: /\bgecko\b/gi, replacement: "게코" },
  { pattern: /\bpython\b/gi, replacement: "파이톤" },
  { pattern: /\bhet\b/gi, replacement: "헤트" },
  { pattern: /\bmale\b/gi, replacement: "수컷" },
  { pattern: /\bfemale\b/gi, replacement: "암컷" },
  { pattern: /\byoung\b/gi, replacement: "젊은" },
  { pattern: /\bbaby\b/gi, replacement: "유생" },
  { pattern: /\bpair\b/gi, replacement: "한 쌍" },
  { pattern: /\bdalmatian\b/gi, replacement: "달마시안" },
  { pattern: /\bpinstripe\b/gi, replacement: "핀스트라이프" },
  { pattern: /\baxanthic\b/gi, replacement: "아잔틱" },
  { pattern: /\bblue\b/gi, replacement: "블루" },
  { pattern: /\bleopard\b/gi, replacement: "레오파드" },
];

const normalizeKoreanByContext = (value: string) =>
  KR_TRANSLATE_RULES.reduce((acc, rule) => acc.replace(rule.pattern, rule.replacement), value);

const translateToKoreanText = (value: string) => {
  if (!value) return value;
  return normalizeKoreanByContext(value);
};

const KO_TITLE_PREFIXES = [
  "✨",
  "⭐",
  "추천",
  "상태 좋은",
  "클린한",
  "건강 체크 완료",
  "실물 확인 완료",
];

const KO_TITLE_SUFFIXES = [
  "판매합니다",
  "급하게 찾는 분께",
  "입문자도 OK",
  "빠른 응대",
  "연락 환영",
  "직접 확인 가능",
];

const KO_DESCRIPTION_LEADS = [
  "원하는 동물의 정보를 정리해 올렸습니다.",
  "사진 기준으로 상태와 형태를 같이 확인했습니다.",
  "체크 리스트를 기반으로 사육 환경을 검토했습니다.",
  "상태 관리가 잘 된 개체입니다.",
  "문진 결과를 반영해 정리한 상품입니다.",
];

const KO_DESCRIPTION_MID = [
  "거래 전 상태 문의 주시면 상세 정보를 더 안내해드릴 수 있습니다.",
  "실제 색상은 촬영 환경에 따라 다르게 보일 수 있습니다.",
  "개체 성격은 안정적이며 초보자도 다루기 쉬운 편입니다.",
  "교배용인지 개체 전용용인지 추가로 확인 가능합니다.",
  "최근 입고분으로 상태가 양호한 편입니다.",
];

const KO_DESCRIPTION_TAILS = [
  "빠른 처리 원하시면 연락 주세요.",
  "원하시는 방식으로 협의 후 거래 가능합니다.",
  "상태 문의는 DM으로 먼저 주세요.",
  "배송일정은 거래 후 협의합니다.",
  "관심 있으시면 바로 메시지 주세요.",
];

const hashFromString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
};

const pickBySeed = (items: string[], seed: string) =>
  items[Math.abs(hashFromString(seed)) % items.length];

const mixKoreanVariation = (title: string, description: string, sourceKey: string) => {
  const prefix = pickBySeed(KO_TITLE_PREFIXES, `${sourceKey}-prefix`);
  const suffix = pickBySeed(KO_TITLE_SUFFIXES, `${sourceKey}-suffix`);
  const lead = pickBySeed(KO_DESCRIPTION_LEADS, `${sourceKey}-lead`);
  const mid = pickBySeed(KO_DESCRIPTION_MID, `${sourceKey}-mid`);
  const tail = pickBySeed(KO_DESCRIPTION_TAILS, `${sourceKey}-tail`);

  const mixedTitle = [prefix, title, suffix]
    .filter((value) => value && value.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  const mixedDescription = [lead, description, mid, tail]
    .filter((value) => value && value.trim().length > 0)
    .join("\n\n")
    .slice(0, 1900);

  return { title: mixedTitle, description: mixedDescription };
};

const removeSummaryBlock = (value: string) =>
  value
    .replace(/\[한글 요약\][\s\S]*/g, "")
    .replace(/\[Korean summary\][\s\S]*/gi, "")
    .trim();

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);

  const getValue = (name: string) => {
    const raw = args.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
    if (!raw) return undefined;
    if (raw.includes("=")) return raw.split("=")[1] ?? "";

    const idx = args.indexOf(raw);
    return args[idx + 1];
  };

  const toNumber = (name: string, fallback: number) => {
    const value = getValue(name);
    const parsed = value ? Number(value) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const getBool = (name: string) => args.includes(`--${name}`);

  const userId = Number(getValue("user-id"));

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("--user-id는 필수이며 양수 정수여야 합니다.");
  }

  return {
    userId,
    maxPages: toNumber("max-pages", 1),
    pageSize: toNumber("page-size", 24),
    maxItems: toNumber("max-items", DEFAULT_MAX_ITEMS),
    durationHours: toNumber("duration-hours", DEFAULT_AUCTION_DURATION_HOURS),
    includeInquirePrice: getBool("include-inquire-price"),
    dryRun: getBool("dry-run"),
    category: getValue("category") || DEFAULT_MORPHMARKET_CATEGORY,
    region: getValue("region") || DEFAULT_MORPHMARKET_REGION,
    state: getValue("state") || "for_sale",
    morphExchangeRate: toNumber("exchange-rate", DEFAULT_MORPH_EXCHANGE_RATE),
    delayMs: toNumber("delay-ms", 900),
    search: getValue("search") || getValue("q") || "",
    translateToKorean: getBool("translate-ko"),
    maxStartPrice: (() => {
      const raw = getValue("max-start-price");
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  };
};

const formatHelp = () => {
  return `
Usage:
  npx ts-node --transpile-only scripts/import-morphmarket-auctions.ts --user-id=<BRIYDI_USER_ID>

Options:
  --user-id                (required) 브리디 사용자 ID (필수)
  --max-pages              수집할 페이지 수 (기본: 1)
  --page-size              MorphMarket 페이지 size (기본: 24)
  --max-items              등록 시도 최대 건수 (기본: ${DEFAULT_MAX_ITEMS})
  --duration-hours         경매 종료 시간(시간 단위, 기본: ${DEFAULT_AUCTION_DURATION_HOURS})
  --exchange-rate          USD->KRW 환율 (기본: ${DEFAULT_MORPH_EXCHANGE_RATE})
  --max-start-price        시작가 상한선(원화, 지정 시 초과 스킵)
  --include-inquire-price  '가격 문의' 건도 가져오기 (기본: 제외)
  --dry-run                실제 생성 없이 검증만 수행
  --category               MorphMarket 카테고리 slug (기본: cgs)
  --search                 검색 키워드(예: geckos). 대소문자 구분 없음
  --translate-ko           제목/설명을 로컬 사전 기반 한글 변환
  --region                 지역 코드 (기본: us)
  --state                  상태 필터 (기본: for_sale)
  --delay-ms               목록/등록 간 대기(ms, 기본: 900)
`;
};

const toFetchList = (listing: MorphmarketListing): string[] => {
  const thumb = listing.thumb_image;
  const result: string[] = [];

  const extractFromString = (value: string) =>
    value
      .split(",")
      .map((part) => part.trim().split(" ")[0])
      .filter((part): part is string => part.startsWith("http"));

  if (typeof thumb === "string") {
    return extractFromString(thumb);
  }

  if (Array.isArray(thumb)) {
    return thumb
      .flatMap((entry) => {
        if (typeof entry === "string") return extractFromString(entry);
        if (entry && typeof entry === "object" && "src" in entry) {
          return extractFromString(asString((entry as JsonObject).src));
        }
        return [] as string[];
      })
      .filter((value): value is string => value.startsWith("http"));
  }

  if (thumb && typeof thumb === "object" && "src" in thumb) {
    const src = asString((thumb as JsonObject).src);
    if (!src) return result;
    return extractFromString(src);
  }

  return result;
};

const resolveImageMimeFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".webp")) return "image/webp";
  return "image/jpeg";
};

const uploadImageToCloudflare = async (url: string) => {
  const cloudResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ID}/images/v1/direct_upload`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CF_TOKEN}`,
      },
    }
  );

  const cloudPayload = (await cloudResponse.json().catch(() => null)) as
    | {
        success?: boolean;
        result?: {
          id?: string;
          uploadURL?: string;
        };
      }
    | null;

  if (!cloudPayload?.success || !cloudPayload.result?.uploadURL || !cloudPayload.result?.id) {
    throw new Error("Cloudflare 업로드 URL 발급에 실패했습니다.");
  }

  const imageResponse = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.morphmarket.com/",
      Accept: "image/*",
    },
  });

  if (!imageResponse.ok) {
    throw new Error(`썸네일 다운로드 실패: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const imageBlob = await imageResponse.blob();
  const imageFile = new File([imageBlob], `morph-${Date.now()}.jpg`, {
    type: resolveImageMimeFromUrl(url),
  });

  const formData = new FormData();
  formData.append("file", imageFile);

  const uploaded = await fetch(cloudPayload.result.uploadURL, {
    method: "POST",
    body: formData,
  });

  const uploadText = await uploaded.text();
  const uploadPayload = (await (() => {
    try {
      return Promise.resolve(JSON.parse(uploadText));
    } catch {
      return Promise.resolve(null);
    }
  })()) as
    | {
        success?: boolean;
        result?: {
          id?: string;
        };
      }
    | null;

  if (!uploaded.ok || !uploadPayload?.success || !uploadPayload.result?.id) {
    throw new Error(
      `Cloudflare 이미지 업로드 실패: uploadedOk=${uploaded.ok}, status=${uploaded.status}, payload=${uploadText}`,
    );
  }

  return uploadPayload.result.id;
};

const fetchMorphmarketPage = async (
  page: number,
  pageSize: number,
  category: string,
  region: string,
  state: string,
  search?: string,
): Promise<MorphmarketListing[]> => {
  const apiUrl = new URL("https://www.morphmarket.com/api/v1/listings/");
  apiUrl.searchParams.set("category", category);
  apiUrl.searchParams.set("page", String(page));
  apiUrl.searchParams.set("page_size", String(pageSize));
  apiUrl.searchParams.set("region", region);
  apiUrl.searchParams.set("state", state);
  apiUrl.searchParams.set("view", "grid");
  if (search) apiUrl.searchParams.set("search", search);

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`MorphMarket API 실패: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as JsonValue;
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as JsonObject).results)) {
    throw new Error("MorphMarket 응답 형태가 예상과 다릅니다.");
  }

  return ((payload as JsonObject).results as JsonValue[])
    .map((value) => (typeof value === "object" && value ? (value as MorphmarketListing) : null))
    .filter((entry): entry is MorphmarketListing => entry !== null);
};

const mapListingToImport = (listing: MorphmarketListing, options: CliOptions): ImportRow | null => {
  const sourceKey = asString(listing.key);
  if (!sourceKey) {
    return null;
  }

  const title = asString(listing.title);
  if (!title) {
    return null;
  }

  const inquireForPrice = listing.inquire_for_price === true;
  if (inquireForPrice && !options.includeInquirePrice) {
    return null;
  }

  const rawPrice =
    asNumber(listing.usd_price) ??
    asNumber(listing.price) ??
    asNumber(listing.original_price);
  if (rawPrice === null || rawPrice <= 0) {
    return null;
  }

  const rawCurrency = asString(listing.price_currency).toUpperCase();
  let startPrice = rawPrice;
  if (rawCurrency.includes("USD") || rawCurrency === "") {
    startPrice = rawPrice * options.morphExchangeRate;
  }
  if (rawCurrency.includes("KRW")) {
    startPrice = rawPrice;
  }

  if (Number.isNaN(startPrice) || !Number.isFinite(startPrice)) {
    return null;
  }

  const roundStartPrice = Math.max(
    AUCTION_MIN_START_PRICE,
    Math.round(startPrice / 1000) * 1000
  );

  if (options.maxStartPrice && roundStartPrice > options.maxStartPrice) {
    return null;
  }

  const sourceUrl = asString(listing.share_link);
  const maturity = asString(listing.maturity);
  const sex = asString(listing.sex);
  const categoryName = asString(listing.category_name);
  const scientificName = asString(listing.category_scientific_name);
  const shippingType = asString(listing.shipping_type);
  const minShipping = asNumber(listing.min_shipping);
  const maxShipping = asNumber(listing.max_shipping);
  const baseDescription = removeSummaryBlock(stripHtml(asString(listing.description)));

  const extraLines = [
    baseDescription,
    categoryName ? `분류: ${categoryName}` : null,
    scientificName ? `학명: ${scientificName}` : null,
    sex ? `성별: ${sex}` : null,
    maturity ? `성체 단계: ${maturity}` : null,
    shippingType ? `배송 방식: ${shippingType}` : null,
    minShipping !== null || maxShipping !== null
      ? `배송비: ${minShipping ?? "-"} ~ ${maxShipping ?? "-"}`
      : null,
  ].filter((line): line is string => typeof line === "string" && line.trim().length > 0);

  const description = extraLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n\n")
    .slice(0, 1900);

  const durationMs = options.durationHours * 60 * 60 * 1000;
  if (durationMs < AUCTION_MIN_DURATION_MS || durationMs > AUCTION_MAX_DURATION_MS) {
    return null;
  }

  const endAt = new Date(Date.now() + durationMs);
  const rawImages = toFetchList(listing);

  const photos = rawImages
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, MAX_PHOTOS_PER_AUCTION);

  const normalizedTitle = options.translateToKorean
    ? translateToKoreanText(title.slice(0, 100))
    : title.slice(0, 100);
  const normalizedDescription = options.translateToKorean
    ? description.trim()
    : description;

  const mixed = options.translateToKorean
    ? mixKoreanVariation(normalizedTitle, normalizedDescription, sourceKey)
    : { title: normalizedTitle, description: normalizedDescription };

  return {
    sourceKey,
    title: mixed.title,
    description: mixed.description.slice(0, 1900),
    startPrice: roundStartPrice,
    endAt,
    photos,
    sourceUrl,
  };
};

const validateImporter = async (
  userId: number,
) => {
  const importer = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, phone: true, email: true },
  });

  if (!importer) {
    throw new Error(`importer userId(${userId})를 찾지 못했습니다.`);
  }

  if (importer.status !== "ACTIVE") {
    throw new Error("importer 사용자 상태가 ACTIVE가 아닙니다.");
  }

  return importer;
};

const uploadPhotos = async (
  sourcePhotos: string[],
  logPrefix: string,
): Promise<string[]> => {
  const uploaded: string[] = [];

  for (const photoUrl of sourcePhotos) {
    try {
      const imageId = await uploadImageToCloudflare(photoUrl);
      uploaded.push(imageId);
      console.log(`  [${logPrefix}] 업로드 완료: ${photoIdToShort(imageId)}`);
    } catch (error) {
      if (process.env.MORPH_IMPORT_DEBUG === "true") {
        console.error(`[${logPrefix}] 업로드 상세 오류`, error instanceof Error ? error.message : error);
      }
      console.warn(
        `  [${logPrefix}] 이미지 업로드 실패: ${photoUrl}`,
      );
    }
  }

  return uploaded;
};

const photoIdToShort = (photoId: string) => photoId.slice(0, 10);

const shouldSkipByDuplicate = async (
  userId: number,
  payload: Omit<ImportRow, "photos" | "sourceStore" | "sourceKey">
) => {
  const sellerTrustNote = payload.sourceUrl ? `입력 데이터: ${payload.sourceUrl}` : null;
  if (sellerTrustNote) {
    const duplicatedBySource = await client.auction.findFirst({
      where: {
        userId,
        sellerTrustNote,
      },
      select: { id: true },
    });

    if (duplicatedBySource) {
      return true;
    }
  }

  const duplicated = await client.auction.findFirst({
    where: {
      userId,
      title: payload.title,
      description: payload.description,
      startPrice: payload.startPrice,
      endAt: payload.endAt,
      category: "파충류",
    },
    select: { id: true },
  });

  return Boolean(duplicated);
};

const createAuction = async (
  importerId: number,
  payload: ImportRow,
  dryRun: boolean,
  importerHasContact: boolean,
): Promise<{ created: boolean; id: number | null; reason?: string }> => {
  if (!payload.title || payload.description.length === 0) {
    return { created: false, id: null, reason: "필수 항목 부족" };
  }

  if (payload.photos.length === 0) {
    return { created: false, id: null, reason: "사진 없음" };
  }

  if (payload.startPrice > AUCTION_HIGH_PRICE_REQUIRE_CONTACT && !importerHasContact) {
    return { created: false, id: null, reason: "시작가 기준 고가 경매로 연락처가 필요" };
  }

  if (dryRun) {
    return { created: false, id: null, reason: "dry-run" };
  }

  const activeCount = await client.auction.count({
    where: { userId: importerId, status: "진행중" },
  });

  if (activeCount >= AUCTION_MAX_ACTIVE_PER_USER) {
    return {
      created: false,
      id: null,
      reason: `동시 경매 한도 초과 (${AUCTION_MAX_ACTIVE_PER_USER})`,
    };
  }

  const auction = await client.auction.create({
    data: {
      title: payload.title,
      description: payload.description,
      photos: payload.photos,
      category: "파충류",
      startPrice: payload.startPrice,
      currentPrice: payload.startPrice,
      minBidIncrement: getBidIncrement(payload.startPrice),
      endAt: payload.endAt,
      sellerPhone: null,
      sellerEmail: null,
      sellerBlogUrl: null,
      sellerCafeNick: null,
      sellerBandNick: null,
      sellerProofImage: null,
      sellerTrustNote: `입력 데이터: ${payload.sourceUrl}`,
      user: { connect: { id: importerId } },
    },
  });

  return { created: true, id: auction.id };
};

const main = async () => {
  try {
    const options = parseArgs();
    const importer = await validateImporter(options.userId);
    const importerHasContact = Boolean(importer.phone || importer.email);

    if (typeof process.env.CF_ID !== "string" || typeof process.env.CF_TOKEN !== "string") {
      throw new Error("CF_ID/CF_TOKEN 환경변수가 필요합니다.");
    }

    console.log(`Import target user: ${options.userId}`);
    console.log(`mode: ${options.dryRun ? "DRY RUN" : "WRITE MODE"}`);

    let totalFetched = 0;
    const skippedRows: ImportLog[] = [];
    const seenKeys = new Set<string>();

    const stats: ImportedAuctionResult = {
      totalCandidates: 0,
      skippedByQuery: 0,
      skippedByValidation: 0,
      created: 0,
      failed: 0,
      createdAuctionIds: [],
      skippedRows: skippedRows,
    };

    for (let page = 1; page <= options.maxPages; page += 1) {
      const listings = await fetchMorphmarketPage(
        page,
        options.pageSize,
        options.category,
        options.region,
        options.state,
        options.search,
      );

      console.log(`Page ${page} fetched: ${listings.length}`);
      totalFetched += listings.length;

      for (const listing of listings) {
        if (stats.created + stats.skippedByValidation + stats.skippedByQuery >= options.maxItems) {
          break;
        }

        const mapped = mapListingToImport(listing, options);
        if (!mapped) {
          stats.skippedByQuery += 1;
          skippedRows.push({
            sourceKey: asString(listing.key),
            title: asString(listing.title),
            reason: "맵핑 실패(가격/필수값 누락/쿼리 조건 미충족)",
          });
          continue;
        }

        if (seenKeys.has(mapped.sourceKey)) {
          stats.skippedByValidation += 1;
          skippedRows.push({
            sourceKey: mapped.sourceKey,
            title: mapped.title,
            reason: "중복 key 스킵",
          });
          continue;
        }
        seenKeys.add(mapped.sourceKey);

        if (await shouldSkipByDuplicate(options.userId, {
          title: mapped.title,
          description: mapped.description,
          startPrice: mapped.startPrice,
          endAt: mapped.endAt,
          sourceUrl: mapped.sourceUrl,
        })) {
          stats.skippedByValidation += 1;
          skippedRows.push({
            sourceKey: mapped.sourceKey,
            title: mapped.title,
            reason: "이미 동일 경매 존재",
          });
          continue;
        }

        stats.totalCandidates += 1;

        const uploadedPhotoIds = await uploadPhotos(mapped.photos, mapped.sourceKey);
        if (uploadedPhotoIds.length === 0) {
          stats.skippedByValidation += 1;
          skippedRows.push({
            sourceKey: mapped.sourceKey,
            title: mapped.title,
            reason: "이미지 업로드 실패",
          });
          continue;
        }

        const createResult = await createAuction(
          options.userId,
          {
            ...mapped,
            photos: uploadedPhotoIds,
          },
          options.dryRun,
          importerHasContact,
        );

        if (!createResult.created) {
          stats.failed += 1;
          stats.skippedByValidation += 1;
          skippedRows.push({
            sourceKey: mapped.sourceKey,
            title: mapped.title,
            reason: createResult.reason || "알 수 없는 이유",
          });
        } else if (!options.dryRun && createResult.id) {
          stats.created += 1;
          stats.createdAuctionIds.push(createResult.id);
          console.log(`  [${mapped.sourceKey}] created auction id=${createResult.id}`);
        }

        if (options.delayMs > 0) {
          await delay(options.delayMs);
        }
      }

      if (stats.created + stats.failed >= options.maxItems) {
        break;
      }

      if (page < options.maxPages) {
        await delay(options.delayMs);
      }
    }

    console.log("\nImport summary");
    console.log(`총 후보: ${stats.totalCandidates}`);
    console.log(`생성 성공: ${stats.created}`);
    console.log(`실패/스킵: ${stats.failed + stats.skippedByValidation + stats.skippedByQuery}`);
    console.log(`총 조회: ${totalFetched}`);

    if (stats.createdAuctionIds.length > 0) {
      console.log(`생성된 auction IDs: ${stats.createdAuctionIds.join(", ")}`);
    }

    if (stats.skippedRows.length > 0) {
      console.log("\nSkipped rows:");
      for (const row of stats.skippedRows.slice(0, 20)) {
        console.log(`- ${row.sourceKey}: ${row.reason}`);
      }
      if (stats.skippedRows.length > 20) {
        console.log(`... 그리고 ${stats.skippedRows.length - 20}개 추가`);
      }
    }
  } catch (error) {
    console.error("[Morph import failed]", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
};

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(formatHelp());
  process.exit(0);
}

main();
