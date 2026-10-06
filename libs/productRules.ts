import { findCategoryBranch } from "@libs/categoryTaxonomy";
import { PRODUCT_TYPES } from "@libs/constants";

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
  | "PRODUCT_INVALID_PRODUCT_TYPE";

export interface ProductInputValue {
  name?: string;
  price?: number;
  description?: string;
  photos?: string[];
  category?: string;
  productType?: string;
}

export type ProductValidationResult =
  | { ok: true; value: ProductInputValue }
  | { ok: false; errorCode: ProductValidationErrorCode; message: string };

const fail = (
  errorCode: ProductValidationErrorCode,
  message: string
): ProductValidationResult => ({ ok: false, errorCode, message });

/**
 * 상품 등록/수정 공통 검증.
 * - 상품명·설명은 앞뒤 공백을 제거한 길이로 검사한다.
 * - partial 모드(수정)에서는 보낸 필드(undefined 가 아닌 것)만 검사하고, 보내지 않은 필드는 결과에서 뺀다.
 * - 사진(photos)은 선택 항목이다. 보냈을 때(null/undefined 가 아닐 때)만 검사하고 결과에 넣는다.
 * - 카테고리는 대분류·하위분류·레거시 별칭만, 상품 타입은 생물·용품만 받는다.
 *   requireCategory(등록 API)면 둘 다 필수, 아니면 보냈을 때만 검사한다.
 *   (웹 수정 화면은 카테고리 없이 이 함수로 사전 검사하므로 기본값은 선택이다.)
 */
export const validateProductInput = (
  input: {
    name?: unknown;
    price?: unknown;
    description?: unknown;
    photos?: unknown;
    category?: unknown;
    productType?: unknown;
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
        `상품명은 ${PRODUCT_NAME_MIN_LENGTH}~${PRODUCT_NAME_MAX_LENGTH}자로 입력해주세요.`
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
        `상품 설명은 ${PRODUCT_DESCRIPTION_MIN_LENGTH}~${PRODUCT_DESCRIPTION_MAX_LENGTH}자로 입력해주세요.`
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
      return fail("PRODUCT_INVALID_PRODUCT_TYPE", "상품 타입은 생물·용품 중에서 선택해주세요.");
    }
    value.productType = productType;
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

  if (!trimmedName) errors.name = "상품명을 입력해주세요.";
  else if (trimmedName.length < PRODUCT_NAME_MIN_LENGTH)
    errors.name = `상품명은 ${PRODUCT_NAME_MIN_LENGTH}자 이상 입력해주세요.`;
  else if (trimmedName.length > PRODUCT_NAME_MAX_LENGTH)
    errors.name = `상품명은 ${PRODUCT_NAME_MAX_LENGTH}자 이하로 입력해주세요.`;

  if (!category) errors.category = "카테고리를 선택해주세요.";
  if (!productType) errors.productType = "상품 타입을 선택해주세요.";

  if (price === null) errors.price = "가격을 입력해주세요.";
  else if (!Number.isInteger(price) || price < PRODUCT_PRICE_MIN)
    errors.price = `가격은 ${PRODUCT_PRICE_MIN}원 이상 정수로 입력해주세요.`;
  else if (price > PRODUCT_PRICE_MAX) errors.price = "가격이 너무 큽니다.";

  if (!trimmedDescription) errors.description = "상품 설명을 입력해주세요.";
  else if (trimmedDescription.length < PRODUCT_DESCRIPTION_MIN_LENGTH)
    errors.description = `설명을 ${PRODUCT_DESCRIPTION_MIN_LENGTH}자 이상 입력해주세요.`;
  else if (trimmedDescription.length > PRODUCT_DESCRIPTION_MAX_LENGTH)
    errors.description = `설명은 ${PRODUCT_DESCRIPTION_MAX_LENGTH}자 이하로 입력해주세요.`;

  return errors;
};

/** 화면 위에서부터 첫 오류(상품명 → 카테고리 → 타입 → 가격 → 설명). */
export const firstProductFormError = (errors: ProductFormErrors) =>
  errors.name || errors.category || errors.productType || errors.price || errors.description;
