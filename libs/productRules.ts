import { findCategoryBranch } from "@libs/categoryTaxonomy";
import { PRODUCT_TYPES } from "@libs/constants";
import { isDealType } from "@libs/shared/categories";
import {
  parsePedigreeNote,
  PEDIGREE_NOTE_INVALID_MESSAGE,
  PEDIGREE_WITHOUT_BLOODLINE_MESSAGE,
  type PedigreeNote,
} from "@libs/shared/pedigree-note";

export const PRODUCT_NAME_MIN_LENGTH = 2;
export const PRODUCT_NAME_MAX_LENGTH = 60;
/** 0원은 무료나눔이다(홈 무료나눔 카드 → price=0). */
export const PRODUCT_PRICE_MIN = 0;
export const PRODUCT_PRICE_MAX = 1_000_000_000;
export const PRODUCT_DESCRIPTION_MIN_LENGTH = 10;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 3000;
/** 상품 사진 최대 장수(0장 허용). 웹 업로드 화면과 앱이 같은 값을 쓴다. */
export const PRODUCT_PHOTOS_MAX = 10;

/** 상품 가격 표시: 0 → "무료나눔", null/undefined → "가격 미정", 그 외 "1,234원". */
export const formatProductPrice = (price?: number | null) =>
  price === 0 ? "무료나눔" : price != null ? `${price.toLocaleString()}원` : "가격 미정";

export type ProductValidationErrorCode =
  | "PRODUCT_INVALID_NAME"
  | "PRODUCT_INVALID_PRICE"
  | "PRODUCT_INVALID_DESCRIPTION"
  | "PRODUCT_INVALID_PHOTOS"
  | "PRODUCT_TOO_MANY_PHOTOS"
  | "PRODUCT_INVALID_CATEGORY"
  | "PRODUCT_INVALID_PRODUCT_TYPE"
  | "PRODUCT_INVALID_DEAL_TYPE"
  | "PRODUCT_INVALID_BLOODLINE_ROOT"
  | "PRODUCT_INVALID_PEDIGREE_NOTE"
  | "PRODUCT_PEDIGREE_WITHOUT_BLOODLINE";

/** 상품 혈통 연결 오류 문구(앱 src/lib/bloodlineErrors.ts BLOODLINE_LINK_ERROR_MESSAGES 와 같다). */
export const PRODUCT_INVALID_BLOODLINE_ROOT_MESSAGE = "연결할 혈통을 찾을 수 없어요";
export const PRODUCT_BLOODLINE_FORBIDDEN_MESSAGE =
  "내가 보유했거나 출처 카드를 받은 혈통만 연결할 수 있어요";

export interface ProductInputValue {
  name?: string;
  price?: number;
  description?: string;
  photos?: string[];
  category?: string;
  productType?: string;
  /** 거래 유형(sale/adoption/rehoming). 보내지 않으면 서버 기본값 sale. */
  dealType?: string;
  /**
   * 연결한 뿌리 혈통 id. 보내지 않았으면 키가 없다(수정: 기존 값 유지).
   * null 은 해제다(이때 pedigreeNote 도 null 로 맞춘다).
   */
  bloodlineRootId?: number | null;
  /** 부·모 크기·누대. 보내지 않았으면 키가 없다. 비었거나 null 이면 null(지움). */
  pedigreeNote?: PedigreeNote | null;
}

export type ProductValidationResult =
  | { ok: true; value: ProductInputValue }
  | { ok: false; errorCode: ProductValidationErrorCode; message: string };

const fail = (
  errorCode: ProductValidationErrorCode,
  message: string
): ProductValidationResult => ({ ok: false, errorCode, message });

/** Prisma Int(INT4) 최대값. 이보다 큰 id 는 조회 전에 잘못된 값으로 거른다. */
const INT4_MAX = 2_147_483_647;

/**
 * 요청의 bloodlineRootId. null·빈 문자열이면 null(해제), 양의 정수(숫자 또는 숫자 문자열)면 그 값,
 * 그 밖이면 undefined(잘못된 값).
 */
const readBloodlineRootId = (raw: unknown): number | null | undefined => {
  if (raw === null || raw === "") return null;
  const id =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : Number.NaN;
  return Number.isInteger(id) && id > 0 && id <= INT4_MAX ? id : undefined;
};

/**
 * 상품 등록/수정 공통 검증.
 * - 상품명·설명은 앞뒤 공백을 제거한 길이로 검사한다.
 * - partial 모드(수정)에서는 보낸 필드(undefined 가 아닌 것)만 검사하고, 보내지 않은 필드는 결과에서 뺀다.
 * - 사진(photos)은 선택 항목이다. 보냈을 때(null/undefined 가 아닐 때)만 검사하고 결과에 넣는다.
 * - 카테고리는 대분류·하위분류·레거시 별칭만, 상품 타입은 생물·용품만 받는다.
 *   requireCategory(등록 API)면 둘 다 필수, 아니면 보냈을 때만 검사한다.
 *   (웹 수정 화면은 카테고리 없이 이 함수로 사전 검사하므로 기본값은 선택이다.)
 * - 혈통(bloodlineRootId·pedigreeNote)은 보냈을 때만 검사한다(구 앱은 보내지 않는다).
 *   bloodlineRootId 는 양의 정수 또는 null(해제). null 이면 pedigreeNote 도 null 이다.
 *   등록(partial 아님)에서 혈통 없이 부모 정보만 오면 PRODUCT_PEDIGREE_WITHOUT_BLOODLINE.
 *   수정에서 부모 정보만 오면 기존 혈통이 있는지는 API 가 본다(이 함수는 기존 값을 모른다).
 *   붙일 권한(보유·출처 카드)은 API 가 libs/server/bloodline-link canAttachBloodline 으로 본다.
 */
export const validateProductInput = (
  input: {
    name?: unknown;
    price?: unknown;
    description?: unknown;
    photos?: unknown;
    category?: unknown;
    productType?: unknown;
    dealType?: unknown;
    bloodlineRootId?: unknown;
    pedigreeNote?: unknown;
  },
  {
    partial = false,
    requireCategory = false,
  }: { partial?: boolean; requireCategory?: boolean } = {}
): ProductValidationResult => {
  const value: ProductInputValue = {};

  if (!partial || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < PRODUCT_NAME_MIN_LENGTH || name.length > PRODUCT_NAME_MAX_LENGTH) {
      return fail(
        "PRODUCT_INVALID_NAME",
        `제목은 ${PRODUCT_NAME_MIN_LENGTH}~${PRODUCT_NAME_MAX_LENGTH}자로 입력해주세요.`
      );
    }
    value.name = name;
  }

  if (!partial || input.price !== undefined) {
    const rawPrice = input.price;
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : typeof rawPrice === "string" && rawPrice.trim() !== ""
          ? Number(rawPrice)
          : Number.NaN;
    if (!Number.isInteger(price) || price < PRODUCT_PRICE_MIN || price > PRODUCT_PRICE_MAX) {
      return fail(
        "PRODUCT_INVALID_PRICE",
        `가격은 ${PRODUCT_PRICE_MIN}원~10억원 사이의 정수로 입력해주세요.`
      );
    }
    value.price = price;
  }

  if (!partial || input.description !== undefined) {
    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    if (
      description.length < PRODUCT_DESCRIPTION_MIN_LENGTH ||
      description.length > PRODUCT_DESCRIPTION_MAX_LENGTH
    ) {
      return fail(
        "PRODUCT_INVALID_DESCRIPTION",
        `설명은 ${PRODUCT_DESCRIPTION_MIN_LENGTH}~${PRODUCT_DESCRIPTION_MAX_LENGTH}자로 입력해주세요.`
      );
    }
    value.description = description;
  }

  if (input.photos !== undefined && input.photos !== null) {
    const photos = input.photos;
    if (
      !Array.isArray(photos) ||
      !photos.every((photo) => typeof photo === "string" && photo.trim() !== "")
    ) {
      return fail("PRODUCT_INVALID_PHOTOS", "사진 정보가 올바르지 않습니다.");
    }
    if (photos.length > PRODUCT_PHOTOS_MAX) {
      return fail(
        "PRODUCT_TOO_MANY_PHOTOS",
        `사진은 최대 ${PRODUCT_PHOTOS_MAX}장까지 등록할 수 있습니다.`
      );
    }
    value.photos = photos;
  }

  const sent = (v: unknown) => v !== undefined && v !== null;
  const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (requireCategory || sent(input.category)) {
    const category = trimmed(input.category);
    if (findCategoryBranch(category).parent === "") {
      return fail("PRODUCT_INVALID_CATEGORY", "카테고리를 다시 선택해주세요.");
    }
    value.category = category;
  }

  if (requireCategory || sent(input.productType)) {
    const productType = trimmed(input.productType);
    if (!PRODUCT_TYPES.some((type) => type.id === productType)) {
      return fail("PRODUCT_INVALID_PRODUCT_TYPE", "종류는 생물·용품 중에서 선택해주세요.");
    }
    value.productType = productType;
  }

  if (sent(input.dealType)) {
    const dealType = trimmed(input.dealType);
    if (!isDealType(dealType)) {
      return fail("PRODUCT_INVALID_DEAL_TYPE", "거래 유형을 다시 선택해주세요.");
    }
    value.dealType = dealType;
  }

  if (input.bloodlineRootId !== undefined) {
    const rootId = readBloodlineRootId(input.bloodlineRootId);
    if (rootId === undefined) {
      return fail("PRODUCT_INVALID_BLOODLINE_ROOT", PRODUCT_INVALID_BLOODLINE_ROOT_MESSAGE);
    }
    value.bloodlineRootId = rootId;
  }

  if (input.pedigreeNote !== undefined) {
    const pedigree = parsePedigreeNote(input.pedigreeNote);
    if (!pedigree.ok) {
      return fail("PRODUCT_INVALID_PEDIGREE_NOTE", PEDIGREE_NOTE_INVALID_MESSAGE);
    }
    value.pedigreeNote = pedigree.value;
  }

  // 혈통을 해제하면 부모 정보도 지운다(남아 있던 화면 값이 와도 저장하지 않는다).
  if (value.bloodlineRootId === null) {
    value.pedigreeNote = null;
  }
  if (!partial && value.pedigreeNote && typeof value.bloodlineRootId !== "number") {
    return fail("PRODUCT_PEDIGREE_WITHOUT_BLOODLINE", PEDIGREE_WITHOUT_BLOODLINE_MESSAGE);
  }

  return { ok: true, value };
};

export type ProductFormErrors = {
  name?: string;
  category?: string;
  productType?: string;
  price?: string;
  description?: string;
};

/**
 * 등록·수정 화면 입력 검사(앱 validateProductFields + 카테고리·타입 필수). 오류가 없으면 빈 객체.
 * price 는 화면 입력값(숫자, 비어 있으면 null). 0 은 무료나눔이다.
 */
export const validateProductForm = ({
  name,
  price,
  description,
  category,
  productType,
}: {
  name: string;
  price: number | null;
  description: string;
  category: string;
  productType: string;
}): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (!trimmedName) errors.name = "제목을 입력해주세요.";
  else if (trimmedName.length < PRODUCT_NAME_MIN_LENGTH)
    errors.name = `제목은 ${PRODUCT_NAME_MIN_LENGTH}자 이상 입력해주세요.`;
  else if (trimmedName.length > PRODUCT_NAME_MAX_LENGTH)
    errors.name = `제목은 ${PRODUCT_NAME_MAX_LENGTH}자 이하로 입력해주세요.`;

  if (!category) errors.category = "카테고리를 선택해주세요.";
  if (!productType) errors.productType = "종류를 선택해주세요.";

  if (price === null) errors.price = "가격을 입력해주세요.";
  else if (!Number.isInteger(price) || price < PRODUCT_PRICE_MIN)
    errors.price = `가격은 ${PRODUCT_PRICE_MIN}원 이상 정수로 입력해주세요.`;
  else if (price > PRODUCT_PRICE_MAX) errors.price = "가격이 너무 큽니다.";

  if (!trimmedDescription) errors.description = "설명을 입력해주세요.";
  else if (trimmedDescription.length < PRODUCT_DESCRIPTION_MIN_LENGTH)
    errors.description = `설명을 ${PRODUCT_DESCRIPTION_MIN_LENGTH}자 이상 입력해주세요.`;
  else if (trimmedDescription.length > PRODUCT_DESCRIPTION_MAX_LENGTH)
    errors.description = `설명은 ${PRODUCT_DESCRIPTION_MAX_LENGTH}자 이하로 입력해주세요.`;

  return errors;
};

/** 화면 위에서부터 첫 오류(제목 → 카테고리 → 타입 → 가격 → 설명). */
export const firstProductFormError = (errors: ProductFormErrors) =>
  errors.name || errors.category || errors.productType || errors.price || errors.description;
