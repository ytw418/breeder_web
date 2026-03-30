import { Prisma, type User } from "@prisma/client";

import client from "@libs/server/client";
import {
  BREEDER_PROGRAM_DEFAULT_FEE_BENEFITS,
  BREEDER_PROGRAM_FRAME_VARIANTS,
  BREEDER_PROGRAM_LABELS,
  FOUNDING_BREEDER_LIMIT,
  getNextFoundingBreederNo,
  type BreederProgramSummary,
  type BreederProgramType,
  sortBreederPrograms,
} from "@libs/shared/breeder-program";

type BreederProgramRecord = {
  id: number;
  programType: BreederProgramType;
  status: "ACTIVE" | "REVOKED";
  source: "AUTO_SIGNUP" | "MANUAL_ADMIN" | "SELF_VERIFICATION";
  badgeLabel: string;
  frameVariant: string;
  foundingNo: number | null;
  feeBenefitType:
    | "NONE"
    | "LIFETIME_AUCTION_FEE_FREE"
    | "AUCTION_FEE_PERCENT_DISCOUNT";
  feeDiscountPercent: number | null;
  grantedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionClient = Prisma.TransactionClient;

const MAX_FOUNDING_ASSIGN_RETRIES = 3;

const foundingSelect = {
  id: true,
  programType: true,
  status: true,
  source: true,
  badgeLabel: true,
  frameVariant: true,
  foundingNo: true,
  feeBenefitType: true,
  feeDiscountPercent: true,
  grantedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const toBreederProgramSummary = (
  record: BreederProgramRecord
): BreederProgramSummary => ({
  id: record.id,
  programType: record.programType,
  status: record.status,
  source: record.source,
  badgeLabel: record.badgeLabel,
  frameVariant: record.frameVariant,
  foundingNo: record.foundingNo,
  feeBenefitType: record.feeBenefitType,
  feeDiscountPercent: record.feeDiscountPercent,
  grantedAt: record.grantedAt.toISOString(),
  revokedAt: record.revokedAt?.toISOString() ?? null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export const getSortedActiveBreederProgramSummaries = (
  programs: BreederProgramRecord[]
) =>
  sortBreederPrograms(
    programs
      .filter((program) => program.status === "ACTIVE")
      .map(toBreederProgramSummary)
  );

const isFoundingNoConflict = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const rawTarget = error.meta?.target;
  const targetParts: string[] = Array.isArray(rawTarget)
    ? rawTarget.map((item) => String(item))
    : rawTarget != null
      ? [String(rawTarget)]
      : [];
  const constraint = String(error.meta?.constraint_name ?? "");
  return (
    (targetParts.includes("programType") && targetParts.includes("foundingNo")) ||
    constraint.includes("programType_foundingNo")
  );
};

const isSerializationFailure = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2034";

const isBreederProgramMembershipTableMissing = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021") return false;
  return String(error.meta?.table || "").includes("BreederProgramMembership");
};

const createUserWithoutBreederPrograms = async (
  data: Pick<User, "snsId" | "email" | "name" | "provider" | "avatar">
) => {
  try {
    return await client.user.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raceCreatedUser = await client.user.findUnique({
        where: { snsId: data.snsId },
      });
      if (raceCreatedUser) return raceCreatedUser;
    }

    throw error;
  }
};

const assignFoundingBreederMembership = async (
  tx: TransactionClient,
  userId: number
) => {
  const latestFounding = await tx.breederProgramMembership.findFirst({
    where: { programType: "FOUNDING_BREEDER" },
    orderBy: { foundingNo: "desc" },
    select: { foundingNo: true },
  });

  const nextFoundingNo = getNextFoundingBreederNo(latestFounding?.foundingNo ?? null);
  if (!nextFoundingNo) {
    return null;
  }

  return tx.breederProgramMembership.create({
    data: {
      userId,
      programType: "FOUNDING_BREEDER",
      status: "ACTIVE",
      source: "AUTO_SIGNUP",
      badgeLabel: BREEDER_PROGRAM_LABELS.FOUNDING_BREEDER,
      frameVariant: BREEDER_PROGRAM_FRAME_VARIANTS.FOUNDING_BREEDER,
      foundingNo: nextFoundingNo,
      feeBenefitType: BREEDER_PROGRAM_DEFAULT_FEE_BENEFITS.FOUNDING_BREEDER,
    },
    select: foundingSelect,
  });
};

export const createUserWithAutomaticBreederPrograms = async (
  data: Pick<User, "snsId" | "email" | "name" | "provider" | "avatar">
) => {
  const existingUser = await client.user.findUnique({
    where: { snsId: data.snsId },
  });
  if (existingUser) return existingUser;

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_FOUNDING_ASSIGN_RETRIES; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx) => {
          const user = await tx.user.create({ data });
          await assignFoundingBreederMembership(tx, user.id);
          return user;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      lastError = error;

      if (isFoundingNoConflict(error) || isSerializationFailure(error)) {
        continue;
      }

      if (isBreederProgramMembershipTableMissing(error)) {
        return createUserWithoutBreederPrograms(data);
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raceCreatedUser = await client.user.findUnique({
          where: { snsId: data.snsId },
        });
        if (raceCreatedUser) return raceCreatedUser;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("창립 브리더 자동 부여 처리 중 오류가 발생했습니다.");
};

export const getActiveBreederProgramsByUserId = async (userId: number) => {
  try {
    return await client.breederProgramMembership.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: foundingSelect,
    });
  } catch (error) {
    if (isBreederProgramMembershipTableMissing(error)) {
      return [];
    }

    throw error;
  }
};

export const getFoundingBreederCount = async () => {
  try {
    const latestFounding = await client.breederProgramMembership.findFirst({
      where: { programType: "FOUNDING_BREEDER" },
      orderBy: { foundingNo: "desc" },
      select: { foundingNo: true },
    });

    return Math.min(FOUNDING_BREEDER_LIMIT, latestFounding?.foundingNo ?? 0);
  } catch (error) {
    if (isBreederProgramMembershipTableMissing(error)) {
      return 0;
    }

    throw error;
  }
};
