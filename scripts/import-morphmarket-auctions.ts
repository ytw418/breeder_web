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
  store_name?: unknown;
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
  sourceStore: string | null;
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
}

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

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
  --region                 지역 코드 (기본: us)
  --state                  상태 필터 (기본: for_sale)
  --delay-ms               목록/등록 간 대기(ms, 기본: 900)
`;
};

const toFetchList = (listing: MorphmarketListing): string[] => {
  const thumb = listing.thumb_image;
  const result: string[] = [];

  if (typeof thumb === "string") {
    return thumb
      .split(",")
      .map((part) => part.trim().split(" ")[0])
      .filter((part): part is string => part.startsWith("http"));
  }

  if (thumb && typeof thumb === "object" && "src" in thumb) {
    const src = asString((thumb as JsonObject).src);
    if (!src) return result;
    return src
      .split(",")
      .map((part) => part.trim().split(" ")[0])
      .filter((part): part is string => part.startsWith("http"));
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
    throw new Error(`썸네일 다운로드 실패: ${imageResponse.status}`);
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

  const uploadPayload = (await uploaded.json().catch(() => null)) as
    | {
        success?: boolean;
        result?: {
          id?: string;
        };
      }
    | null;

  if (!uploaded.ok || !uploadPayload?.success || !uploadPayload.result?.id) {
    throw new Error("Cloudflare 이미지 업로드 실패");
  }

  return uploadPayload.result.id;
};

const fetchMorphmarketPage = async (
  page: number,
  pageSize: number,
  category: string,
  region: string,
  state: string,
): Promise<MorphmarketListing[]> => {
  const apiUrl = new URL("https://www.morphmarket.com/api/v1/listings/");
  apiUrl.searchParams.set("category", category);
  apiUrl.searchParams.set("page", String(page));
  apiUrl.searchParams.set("page_size", String(pageSize));
  apiUrl.searchParams.set("region", region);
  apiUrl.searchParams.set("state", state);
  apiUrl.searchParams.set("view", "grid");

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
  const store = asString(listing.store_name) || null;
  const maturity = asString(listing.maturity);
  const sex = asString(listing.sex);
  const categoryName = asString(listing.category_name);
  const scientificName = asString(listing.category_scientific_name);
  const shippingType = asString(listing.shipping_type);
  const minShipping = asNumber(listing.min_shipping);
  const maxShipping = asNumber(listing.max_shipping);
  const baseDescription = stripHtml(asString(listing.description));

  const extraLines = [
    baseDescription,
    store ? `판매자: ${store}` : null,
    categoryName ? `분류: ${categoryName}` : null,
    scientificName ? `학명: ${scientificName}` : null,
    sex ? `성별: ${sex}` : null,
    maturity ? `성체 단계: ${maturity}` : null,
    shippingType ? `배송 방식: ${shippingType}` : null,
    minShipping !== null || maxShipping !== null
      ? `배송비: ${minShipping ?? "-"} ~ ${maxShipping ?? "-"}`
      : null,
    sourceUrl ? `원본: ${sourceUrl}` : null,
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

  return {
    sourceKey,
    title: title.slice(0, 100),
    description,
    startPrice: roundStartPrice,
    endAt,
    photos,
    sourceUrl,
    sourceStore: store,
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
  payload: Omit<ImportRow, "photos" | "sourceUrl" | "sourceStore" | "sourceKey">
) => {
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
