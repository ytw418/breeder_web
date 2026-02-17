import { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { role as UserRole, UserStatus } from "@prisma/client";

const TEST_ACCOUNT_LIMIT = 5;
const TEST_USER_ROLE: UserRole = "FAKE_USER";

const isTestLoginEnabled = () => {
  const rawEnv = String(
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
      process.env.VERCEL_ENV ||
      process.env.NEXT_PUBLIC_APP_ENV ||
      process.env.APP_ENV ||
      process.env.NODE_ENV ||
      "development"
  ).toLowerCase();

  return rawEnv !== "production" && rawEnv !== "prod";
};

type TestAccountItem = {
  id: number;
  name: string;
  email: string | null;
  provider: string;
  createdAt: string;
};

interface TestAccountsResponse {
  success: boolean;
  error?: string;
  users: TestAccountItem[];
}

interface TestAccountSwitchResponse {
  success: boolean;
  error?: string;
}

type TestAccountCreateResponse = TestAccountSwitchResponse & {
  createdCount?: number;
};

type TestAccountRequestBody = {
  action?: "create" | "switch";
  userId?: number;
  count?: number;
  namePrefix?: string;
};

const isSwitchableTestUser = (targetUser?: {
  provider?: string | null;
  role?: UserRole;
  status?: UserStatus;
} | null): boolean => {
  if (!targetUser) return false;
  return targetUser.status === "ACTIVE" && targetUser.role === TEST_USER_ROLE;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestAccountsResponse | TestAccountSwitchResponse>
) {
  if (!isTestLoginEnabled()) {
    return res.status(403).json({
      success: false,
      error: "프로덕션에서는 테스트 로그인 API를 사용할 수 없습니다.",
      users: [],
    } satisfies TestAccountsResponse);
  }

  if (req.method === "GET") {
    const users = await client.user.findMany({
      where: {
        role: TEST_USER_ROLE,
        status: "ACTIVE",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TEST_ACCOUNT_LIMIT,
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      users: users.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    } satisfies TestAccountsResponse);
  }

  if (req.method === "POST") {
    const requestBody = req.body as TestAccountRequestBody;
    const action = requestBody?.action || "switch";

    if (action === "create") {
      const count = Math.min(Math.max(Number(requestBody?.count || 1), 1), 20);
      const namePrefix = String(requestBody?.namePrefix || "fake")
        .trim()
        .slice(0, 12) || "fake";

      try {
        for (let index = 0; index < count; index += 1) {
          let nickname = "";
          for (let attempt = 0; attempt < 30; attempt += 1) {
            const suffix = `${Math.floor(Math.random() * 9000) + 1000}`;
            const candidate = `${namePrefix}${suffix}`;
            const exists = await client.user.findUnique({
              where: { name: candidate },
              select: { id: true },
            });
            if (!exists) {
              nickname = candidate;
              break;
            }
          }

          if (!nickname) {
            nickname = `${namePrefix}${Date.now().toString().slice(-4)}${index}`;
          }

          await client.user.create({
            data: {
              snsId: `seed-${Date.now()}-${randomUUID()}-${index}`,
              provider: "test_user",
              name: nickname,
              email: null,
              role: TEST_USER_ROLE,
            },
          });
        }
      } catch (error) {
        console.log("test-accounts.create.fail", error);
        return res.status(500).json({
          success: false,
          error: "테스트 계정 생성 중 오류가 발생했습니다.",
        } satisfies TestAccountCreateResponse);
      }

      return res.json({
        success: true,
        createdCount: count,
      } satisfies TestAccountCreateResponse);
    }

    const targetUserId = Number(requestBody?.userId);

    if (!targetUserId || Number.isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: "전환할 유저 ID가 필요합니다.",
      } satisfies TestAccountSwitchResponse);
    }

    const targetUser = await client.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        snsId: true,
        provider: true,
        role: true,
        phone: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      },
    });

    if (!isSwitchableTestUser(targetUser)) {
      return res.status(404).json({
        success: false,
        error: "테스트 유저 계정을 찾을 수 없습니다.",
      } satisfies TestAccountSwitchResponse);
    }

    req.session.user = {
      id: targetUser.id,
      snsId: targetUser.snsId,
      provider: targetUser.provider,
      phone: targetUser.phone,
      email: targetUser.email,
      name: targetUser.name,
      avatar: targetUser.avatar,
      createdAt: targetUser.createdAt,
      updatedAt: targetUser.updatedAt,
    };
    await req.session.save();

    return res.json({
      success: true,
    } satisfies TestAccountSwitchResponse);
  }

  return res.status(405).json({
    success: false,
    error: "지원하지 않는 메서드입니다.",
    users: [],
  } satisfies TestAccountsResponse);
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
