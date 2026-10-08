/**
 * @jest-environment node
 */

/**
 * 혈통 만들기 입력 규칙: 이름(libs/shared/bloodline-names), 오류 코드 표(libs/shared/bloodline-errors),
 * 종 검증(libs/server/bloodline-species — #173 노출 카테고리 이름), 산지 입력(libs/shared/regions).
 */

const VISIBLE_TREE = [
  { id: 1, name: "곤충", slug: "insect", parentId: null, path: "/insect/", sortOrder: 1 },
  { id: 11, name: "사슴벌레", slug: "stag-beetle", parentId: 1, path: "/insect/stag-beetle/", sortOrder: 1 },
  { id: 5, name: "포유류", slug: "mammal", parentId: null, path: "/mammal/", sortOrder: 5 },
  { id: 30, name: "강아지", slug: "dog", parentId: 5, path: "/mammal/dog/", sortOrder: 7 },
  { id: 31, name: "고양이", slug: "cat", parentId: 5, path: "/mammal/cat/", sortOrder: 8 },
  { id: 99, name: "기타", slug: "etc", parentId: null, path: "/etc/", sortOrder: 99 },
];
const mockGetVisibleCategories = jest.fn(async () => VISIBLE_TREE);
jest.mock("@libs/server/categories", () => ({
  getVisibleCategories: () => mockGetVisibleCategories(),
}));

import {
  BLOODLINE_NAME_MAX_LENGTH,
  BLOODLINE_NAME_MIN_LENGTH,
  BLOODLINE_NAME_PATTERN,
  BLOODLINE_NAME_RULE_MESSAGE,
  bloodlineNameKey,
  isValidBloodlineName,
  normalizeBloodlineName,
  validateBloodlineName,
} from "@libs/shared/bloodline-names";
import {
  BLOODLINE_ERRORS,
  BLOODLINE_ERROR_CODES,
  bloodlineErrorMessage,
  isBloodlineErrorCode,
} from "@libs/shared/bloodline-errors";
import { resolveBloodlineSpecies } from "@libs/server/bloodline-species";
import { parseOptionalRegion } from "@libs/shared/regions";

describe("혈통 이름 규칙", () => {
  it("띄어쓰기를 허용하고 연속 공백을 하나로 줄인다", () => {
    expect(normalizeBloodlineName("  강산   라인 ")).toBe("강산 라인");
    expect(normalizeBloodlineName("강산\t라인")).toBe("강산 라인");
    expect(normalizeBloodlineName("강산 라인")).toBe("강산 라인");
    expect(validateBloodlineName("강산  라인")).toEqual({ ok: true, name: "강산 라인" });
    expect(validateBloodlineName("Kang 라인 3")).toEqual({ ok: true, name: "Kang 라인 3" });
    expect(BLOODLINE_NAME_PATTERN.test("강산 라인")).toBe(true);
    expect(isValidBloodlineName("강산 라인")).toBe(true);
  });

  it("특수문자·길이 밖 이름을 거부한다", () => {
    expect(validateBloodlineName("강산!")).toEqual({ ok: false, reason: "pattern" });
    expect(validateBloodlineName("강산🐞")).toEqual({ ok: false, reason: "pattern" });
    expect(validateBloodlineName("강산_라인")).toEqual({ ok: false, reason: "pattern" });
    expect(validateBloodlineName("강")).toEqual({ ok: false, reason: "length" });
    expect(validateBloodlineName("가".repeat(41))).toEqual({ ok: false, reason: "length" });
    expect(validateBloodlineName("가".repeat(40))).toEqual({ ok: true, name: "가".repeat(40) });
    expect(validateBloodlineName("")).toEqual({ ok: false, reason: "empty" });
    expect(validateBloodlineName("   ")).toEqual({ ok: false, reason: "empty" });
    expect(validateBloodlineName(undefined)).toEqual({ ok: false, reason: "empty" });
    expect(validateBloodlineName(123)).toEqual({ ok: false, reason: "empty" });
    expect(isValidBloodlineName("강산!")).toBe(false);
    expect(BLOODLINE_NAME_MIN_LENGTH).toBe(2);
    expect(BLOODLINE_NAME_MAX_LENGTH).toBe(40);
    expect(BLOODLINE_NAME_RULE_MESSAGE).toBe("이름은 한글·영문·숫자·띄어쓰기로 2~40자예요");
  });

  it("공백·대소문자만 다른 이름은 같은 키다", () => {
    const key = bloodlineNameKey("강산 라인");
    expect(bloodlineNameKey("강산라인")).toBe(key);
    expect(bloodlineNameKey("강산  라인")).toBe(key);
    expect(bloodlineNameKey(" 강산 라인 ")).toBe(key);
    expect(bloodlineNameKey("Kang Line")).toBe(bloodlineNameKey("kangline"));
    expect(bloodlineNameKey("강산 라인")).not.toBe(bloodlineNameKey("강산 혈통"));
  });
});

describe("혈통 오류 코드", () => {
  it("코드마다 HTTP 상태와 문구가 설계 표와 같다", () => {
    expect(BLOODLINE_ERRORS.BLOODLINE_AUTH_REQUIRED).toEqual({ status: 401, message: "로그인이 필요해요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_NOT_FOUND).toEqual({ status: 404, message: "혈통을 찾을 수 없어요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_INVALID_NAME).toEqual({
      status: 400,
      message: "이름은 한글·영문·숫자·띄어쓰기로 2~40자예요",
    });
    expect(BLOODLINE_ERRORS.BLOODLINE_DUPLICATE_NAME).toEqual({ status: 409, message: "이미 사용 중인 이름이에요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_SPECIES_REQUIRED).toEqual({ status: 400, message: "종을 골라 주세요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_INVALID_SPECIES).toEqual({ status: 400, message: "고를 수 없는 종이에요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_IMAGE_REQUIRED).toEqual({ status: 400, message: "대표 사진 1장이 필요해요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_INVALID_ORIGIN).toEqual({ status: 400, message: "알 수 없는 지역이에요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_RECEIVER_REQUIRED).toEqual({ status: 400, message: "받는 분을 골라 주세요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_RECEIVER_NOT_FOUND).toEqual({
      status: 404,
      message: "받는 분 닉네임을 찾을 수 없어요",
    });
    expect(BLOODLINE_ERRORS.BLOODLINE_RECEIVER_INACTIVE).toEqual({
      status: 400,
      message: "지금은 카드를 받을 수 없는 분이에요",
    });
    expect(BLOODLINE_ERRORS.BLOODLINE_RECEIVER_SELF).toEqual({ status: 400, message: "나에게는 보낼 수 없어요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_BLOCKED).toEqual({ status: 403, message: "보낼 수 없는 분이에요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_FORBIDDEN).toEqual({ status: 403, message: "지금 보유한 분만 할 수 있어요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_ALREADY_SENT).toEqual({ status: 409, message: "이미 받은 분이에요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_CONFLICT).toEqual({ status: 409, message: "잠시 후 다시 시도해 주세요" });
    expect(BLOODLINE_ERRORS.BLOODLINE_REVOKED).toEqual({ status: 404, message: "운영 정책으로 회수된 혈통이에요" });
    for (const code of BLOODLINE_ERROR_CODES) {
      expect(BLOODLINE_ERRORS[code].message).toBeTruthy();
    }
  });

  it("코드로 문구를 고르고 모르는 코드면 서버 문구를 그대로 쓴다", () => {
    expect(isBloodlineErrorCode("BLOODLINE_ALREADY_SENT")).toBe(true);
    expect(isBloodlineErrorCode("PRODUCT_INVALID_BLOODLINE_ROOT")).toBe(false);
    expect(bloodlineErrorMessage("BLOODLINE_ALREADY_SENT", "서버 문구")).toBe("이미 받은 분이에요");
    expect(bloodlineErrorMessage("SOMETHING_NEW", "서버 문구")).toBe("서버 문구");
    expect(bloodlineErrorMessage(undefined, "서버 문구")).toBe("서버 문구");
    expect(bloodlineErrorMessage(undefined)).toBe("잠시 후 다시 시도해 주세요");
  });
});

describe("혈통 종 검증(노출 카테고리 이름)", () => {
  beforeEach(() => mockGetVisibleCategories.mockClear());

  it("노출 카테고리 이름이면 통과하고 categoryId 를 함께 준다", async () => {
    await expect(resolveBloodlineSpecies("사슴벌레")).resolves.toEqual({
      ok: true,
      speciesType: "사슴벌레",
      categoryId: 11,
    });
    await expect(resolveBloodlineSpecies(" 고양이 ")).resolves.toEqual({
      ok: true,
      speciesType: "고양이",
      categoryId: 31,
    });
    await expect(resolveBloodlineSpecies("강아지")).resolves.toMatchObject({ ok: true, categoryId: 30 });
    // 하위가 없는 상위(기타)도 그 자체로 고를 수 있다
    await expect(resolveBloodlineSpecies("기타")).resolves.toMatchObject({ ok: true, categoryId: 99 });
  });

  it("비어 있으면 BLOODLINE_SPECIES_REQUIRED", async () => {
    await expect(resolveBloodlineSpecies(undefined)).resolves.toEqual({
      ok: false,
      errorCode: "BLOODLINE_SPECIES_REQUIRED",
    });
    await expect(resolveBloodlineSpecies("  ")).resolves.toEqual({
      ok: false,
      errorCode: "BLOODLINE_SPECIES_REQUIRED",
    });
    await expect(resolveBloodlineSpecies(null)).resolves.toEqual({
      ok: false,
      errorCode: "BLOODLINE_SPECIES_REQUIRED",
    });
  });

  it("노출 카테고리에 없거나 문자열이 아니면 BLOODLINE_INVALID_SPECIES", async () => {
    await expect(resolveBloodlineSpecies("왕사슴벌레")).resolves.toEqual({
      ok: false,
      errorCode: "BLOODLINE_INVALID_SPECIES",
    });
    // 레거시 별칭은 새로 만들 때 받지 않는다
    await expect(resolveBloodlineSpecies("기타곤충")).resolves.toEqual({
      ok: false,
      errorCode: "BLOODLINE_INVALID_SPECIES",
    });
    await expect(resolveBloodlineSpecies(3)).resolves.toEqual({
      ok: false,
      errorCode: "BLOODLINE_INVALID_SPECIES",
    });
  });
});

describe("산지 입력(시·도만 또는 시·도 + 시·군·구)", () => {
  it("둘 다 비면 null", () => {
    expect(parseOptionalRegion(undefined, undefined)).toBeNull();
    expect(parseOptionalRegion("", null)).toBeNull();
  });

  it("시·도만, 시·도 + 시·군·구를 받는다", () => {
    expect(parseOptionalRegion("충청남도", undefined)).toEqual({ sido: "충청남도", sigungu: null });
    expect(parseOptionalRegion(" 충청남도 ", "공주시")).toEqual({ sido: "충청남도", sigungu: "공주시" });
  });

  it("시·군·구만 오거나 목록 밖이면 invalid", () => {
    expect(parseOptionalRegion(undefined, "공주시")).toBe("invalid");
    expect(parseOptionalRegion("충청남도", "수원시")).toBe("invalid");
    expect(parseOptionalRegion("충남", undefined)).toBe("invalid");
    expect(parseOptionalRegion(3, undefined)).toBe("invalid");
  });
});
