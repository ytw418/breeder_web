export const PRODUCT_NAME_MIN_LENGTH = 2;
export const PRODUCT_NAME_MAX_LENGTH = 60;
export const PRODUCT_PRICE_MIN = 100;
export const PRODUCT_PRICE_MAX = 1_000_000_000;
export const PRODUCT_DESCRIPTION_MIN_LENGTH = 10;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 3000;
/** 상품 사진 최대 장수(0장 허용). 웹 업로드 화면과 앱이 같은 값을 쓴다. */
export const PRODUCT_PHOTOS_MAX = 10;

export type ProductValidationErrorCode =
  | "PRODUCT_INVALID_NAME"
  | "PRODUCT_INVALID_PRICE"
  | "PRODUCT_INVALID_DESCRIPTION"
  | "PRODUCT_INVALID_PHOTOS"
  | "PRODUCT_TOO_MANY_PHOTOS";

export interface ProductInputValue {
  name?: string;
  price?: number;
  description?: string;
  photos?: string[];
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
 */
export const validateProductInput = (
  input: { name?: unknown; price?: unknown; description?: unknown; photos?: unknown },
  { partial = false }: { partial?: boolean } = {}
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
        `가격은 ${PRODUCT_PRICE_MIN.toLocaleString()}원~${PRODUCT_PRICE_MAX.toLocaleString()}원 사이로 입력해주세요.`
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

  return { ok: true, value };
};
