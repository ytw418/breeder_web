import {
  getBreederProgramBenefitLabel,
  getNextFoundingBreederNo,
  isBreederProgramType,
  sortBreederPrograms,
  type BreederProgramSummary,
} from "@libs/shared/breeder-program";

const createProgram = (
  overrides: Partial<BreederProgramSummary>
): BreederProgramSummary => ({
  id: 1,
  programType: "VERIFIED_BREEDER",
  status: "ACTIVE",
  source: "MANUAL_ADMIN",
  badgeLabel: "인증 브리더",
  frameVariant: "verified_blue",
  foundingNo: null,
  feeBenefitType: "NONE",
  feeDiscountPercent: null,
  grantedAt: "2026-03-30T00:00:00.000Z",
  revokedAt: null,
  createdAt: "2026-03-30T00:00:00.000Z",
  updatedAt: "2026-03-30T00:00:00.000Z",
  ...overrides,
});

describe("breeder program helpers", () => {
  it("창립 브리더 번호는 100명까지만 증가한다", () => {
    expect(getNextFoundingBreederNo(null)).toBe(1);
    expect(getNextFoundingBreederNo(1)).toBe(2);
    expect(getNextFoundingBreederNo(99)).toBe(100);
    expect(getNextFoundingBreederNo(100)).toBeNull();
  });

  it("프로그램은 창립 > 파트너 > 인증 순으로 정렬한다", () => {
    const programs = sortBreederPrograms([
      createProgram({ id: 3, programType: "VERIFIED_BREEDER" }),
      createProgram({ id: 2, programType: "PARTNER_BREEDER" }),
      createProgram({ id: 1, programType: "FOUNDING_BREEDER" }),
    ]);

    expect(programs.map((program) => program.programType)).toEqual([
      "FOUNDING_BREEDER",
      "PARTNER_BREEDER",
      "VERIFIED_BREEDER",
    ]);
  });

  it("혜택 문구를 프로그램 유형에 맞게 반환한다", () => {
    expect(
      getBreederProgramBenefitLabel(
        createProgram({
          programType: "FOUNDING_BREEDER",
          feeBenefitType: "LIFETIME_AUCTION_FEE_FREE",
        })
      )
    ).toBe("평생 경매 수수료 무료");

    expect(
      getBreederProgramBenefitLabel(
        createProgram({
          programType: "PARTNER_BREEDER",
          feeBenefitType: "AUCTION_FEE_PERCENT_DISCOUNT",
          feeDiscountPercent: 20,
        })
      )
    ).toBe("경매 수수료 20% 할인");

    expect(
      getBreederProgramBenefitLabel(
        createProgram({
          programType: "VERIFIED_BREEDER",
        })
      )
    ).toBe("브리더 신뢰 인증 완료");
  });

  it("프로그램 타입 유효성 검사를 지원한다", () => {
    expect(isBreederProgramType("FOUNDING_BREEDER")).toBe(true);
    expect(isBreederProgramType("PARTNER_BREEDER")).toBe(true);
    expect(isBreederProgramType("VERIFIED_BREEDER")).toBe(true);
    expect(isBreederProgramType("INVALID")).toBe(false);
  });
});
