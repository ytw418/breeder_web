export const FOUNDING_BREEDER_LIMIT = 100;

export const BREEDER_PROGRAM_PRIORITY = [
  "FOUNDING_BREEDER",
  "PARTNER_BREEDER",
  "VERIFIED_BREEDER",
] as const;

export type BreederProgramType = (typeof BREEDER_PROGRAM_PRIORITY)[number];
export type BreederProgramStatus = "ACTIVE" | "REVOKED";
export type BreederProgramSource =
  | "AUTO_SIGNUP"
  | "MANUAL_ADMIN"
  | "SELF_VERIFICATION";
export type BreederProgramFeeBenefitType =
  | "NONE"
  | "LIFETIME_AUCTION_FEE_FREE"
  | "AUCTION_FEE_PERCENT_DISCOUNT";

export const isBreederProgramType = (
  value: string
): value is BreederProgramType =>
  BREEDER_PROGRAM_PRIORITY.includes(value as BreederProgramType);

export const BREEDER_PROGRAM_LABELS: Record<
  BreederProgramType,
  string
> = {
  FOUNDING_BREEDER: "창립 브리더",
  PARTNER_BREEDER: "파트너 브리더",
  VERIFIED_BREEDER: "인증 브리더",
};

export const BREEDER_PROGRAM_FRAME_VARIANTS: Record<
  BreederProgramType,
  string
> = {
  FOUNDING_BREEDER: "founding_gold",
  PARTNER_BREEDER: "partner_crimson",
  VERIFIED_BREEDER: "verified_blue",
};

export const BREEDER_PROGRAM_DEFAULT_FEE_BENEFITS: Record<
  BreederProgramType,
  BreederProgramFeeBenefitType
> = {
  FOUNDING_BREEDER: "LIFETIME_AUCTION_FEE_FREE",
  PARTNER_BREEDER: "AUCTION_FEE_PERCENT_DISCOUNT",
  VERIFIED_BREEDER: "NONE",
};

export interface BreederProgramSummary {
  id: number;
  programType: BreederProgramType;
  status: BreederProgramStatus;
  source: BreederProgramSource;
  badgeLabel: string;
  frameVariant: string;
  foundingNo: number | null;
  feeBenefitType: BreederProgramFeeBenefitType;
  feeDiscountPercent: number | null;
  grantedAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getBreederProgramPriority = (programType: BreederProgramType) =>
  BREEDER_PROGRAM_PRIORITY.indexOf(programType);

export const sortBreederPrograms = <T extends { programType: BreederProgramType }>(
  programs: T[]
) =>
  [...programs].sort(
    (left, right) =>
      getBreederProgramPriority(left.programType) -
      getBreederProgramPriority(right.programType)
  );

export const getPrimaryBreederProgram = <T extends { programType: BreederProgramType }>(
  programs: T[]
) => sortBreederPrograms(programs)[0] ?? null;

export const getNextFoundingBreederNo = (currentMax: number | null) => {
  const normalizedMax = currentMax ?? 0;
  if (normalizedMax >= FOUNDING_BREEDER_LIMIT) {
    return null;
  }
  return normalizedMax + 1;
};

export const getBreederProgramBenefitLabel = (
  program: Pick<
    BreederProgramSummary,
    "feeBenefitType" | "feeDiscountPercent" | "programType"
  >
) => {
  if (program.feeBenefitType === "LIFETIME_AUCTION_FEE_FREE") {
    return "평생 경매 수수료 무료";
  }
  if (
    program.feeBenefitType === "AUCTION_FEE_PERCENT_DISCOUNT" &&
    typeof program.feeDiscountPercent === "number"
  ) {
    return `경매 수수료 ${program.feeDiscountPercent}% 할인`;
  }
  if (program.programType === "VERIFIED_BREEDER") {
    return "브리더 신뢰 인증 완료";
  }
  return null;
};
