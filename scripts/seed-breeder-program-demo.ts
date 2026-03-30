import { PrismaClient, role as UserRole } from "@prisma/client";

const client = new PrismaClient();

type DemoProgram =
  | {
      programType: "FOUNDING_BREEDER";
      badgeLabel: string;
      frameVariant: string;
      feeBenefitType: "LIFETIME_AUCTION_FEE_FREE";
    }
  | {
      programType: "PARTNER_BREEDER";
      badgeLabel: string;
      frameVariant: string;
      feeBenefitType: "AUCTION_FEE_PERCENT_DISCOUNT";
      feeDiscountPercent: number;
    }
  | {
      programType: "VERIFIED_BREEDER";
      badgeLabel: string;
      frameVariant: string;
      feeBenefitType: "NONE";
    };

type DemoUser = {
  snsId: string;
  baseName: string;
  programs: DemoProgram[];
};

const TEST_USER_ROLE: UserRole = "FAKE_USER";

const DEMO_USERS: DemoUser[] = [
  {
    snsId: "demo-breeder-founding",
    baseName: "창립브리더Demo100",
    programs: [
      {
        programType: "FOUNDING_BREEDER",
        badgeLabel: "창립 브리더",
        frameVariant: "founding_gold",
        feeBenefitType: "LIFETIME_AUCTION_FEE_FREE",
      },
    ],
  },
  {
    snsId: "demo-breeder-partner",
    baseName: "파트너브리더Demo",
    programs: [
      {
        programType: "PARTNER_BREEDER",
        badgeLabel: "파트너 브리더",
        frameVariant: "partner_crimson",
        feeBenefitType: "AUCTION_FEE_PERCENT_DISCOUNT",
        feeDiscountPercent: 20,
      },
    ],
  },
  {
    snsId: "demo-breeder-verified",
    baseName: "인증브리더Demo",
    programs: [
      {
        programType: "VERIFIED_BREEDER",
        badgeLabel: "인증 브리더",
        frameVariant: "verified_blue",
        feeBenefitType: "NONE",
      },
    ],
  },
];

async function resolveUniqueName(baseName: string, snsId: string) {
  const existingOwner = await client.user.findUnique({
    where: { snsId },
    select: { id: true, name: true },
  });
  if (existingOwner?.name) {
    return existingOwner.name;
  }

  for (let suffix = 0; suffix < 20; suffix += 1) {
    const candidate = suffix === 0 ? baseName : `${baseName}${suffix}`;
    const nameOwner = await client.user.findUnique({
      where: { name: candidate },
      select: { id: true },
    });
    if (!nameOwner) {
      return candidate;
    }
  }

  return `${baseName}${Date.now().toString().slice(-4)}`;
}

async function getNextFoundingNo() {
  const latest = await client.breederProgramMembership.findFirst({
    where: { programType: "FOUNDING_BREEDER" },
    orderBy: { foundingNo: "desc" },
    select: { foundingNo: true },
  });

  const nextNo = (latest?.foundingNo ?? 0) + 1;
  if (nextNo > 100) {
    throw new Error("창립 브리더 슬롯이 모두 사용 중입니다.");
  }
  return nextNo;
}

async function ensureDemoUser(demoUser: DemoUser) {
  const resolvedName = await resolveUniqueName(demoUser.baseName, demoUser.snsId);
  const now = new Date();
  const existing = await client.user.findUnique({
    where: { snsId: demoUser.snsId },
    select: { id: true },
  });

  if (existing) {
    return client.user.update({
      where: { id: existing.id },
      data: {
        name: resolvedName,
        provider: "test_user",
        role: TEST_USER_ROLE,
        status: "ACTIVE",
        email: null,
        avatar: null,
        createdAt: now,
      },
      select: { id: true, name: true },
    });
  }

  return client.user.create({
    data: {
      snsId: demoUser.snsId,
      provider: "test_user",
      role: TEST_USER_ROLE,
      status: "ACTIVE",
      email: null,
      avatar: null,
      name: resolvedName,
      createdAt: now,
    },
    select: { id: true, name: true },
  });
}

async function ensurePrograms(
  userId: number,
  programs: DemoProgram[]
) {
  const desiredTypes = programs.map((program) => program.programType);

  await client.breederProgramMembership.deleteMany({
    where: {
      userId,
      programType: {
        notIn: desiredTypes,
      },
    },
  });

  for (const program of programs) {
    const existing = await client.breederProgramMembership.findUnique({
      where: {
        userId_programType: {
          userId,
          programType: program.programType,
        },
      },
      select: {
        id: true,
        foundingNo: true,
      },
    });

    const baseData = {
      status: "ACTIVE" as const,
      revokedAt: null,
      source:
        program.programType === "FOUNDING_BREEDER"
          ? ("AUTO_SIGNUP" as const)
          : ("MANUAL_ADMIN" as const),
      badgeLabel: program.badgeLabel,
      frameVariant: program.frameVariant,
      feeBenefitType: program.feeBenefitType,
      feeDiscountPercent:
        program.programType === "PARTNER_BREEDER"
          ? program.feeDiscountPercent
          : null,
    };

    if (existing) {
      await client.breederProgramMembership.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          foundingNo:
            program.programType === "FOUNDING_BREEDER"
              ? existing.foundingNo ?? (await getNextFoundingNo())
              : null,
        },
      });
      continue;
    }

    await client.breederProgramMembership.create({
      data: {
        userId,
        ...baseData,
        programType: program.programType,
        grantedAt: new Date(),
        foundingNo:
          program.programType === "FOUNDING_BREEDER"
            ? await getNextFoundingNo()
            : null,
      },
    });
  }
}

async function main() {
  const results: Array<{ id: number; name: string; path: string }> = [];

  for (const demoUser of DEMO_USERS) {
    const user = await ensureDemoUser(demoUser);
    await ensurePrograms(user.id, demoUser.programs);
    results.push({
      id: user.id,
      name: user.name,
      path: `/profiles/${user.id}`,
    });
  }

  console.log("브리더 프로그램 데모 계정 준비 완료");
  for (const result of results) {
    console.log(`- ${result.name} (${result.id}): ${result.path}`);
  }
  console.log("- 관리자 설정 화면: /admin/breeder-programs");
  console.log("- 로그인 소개 카드: /auth/login");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.$disconnect();
  });
