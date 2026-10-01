import { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { issueTokens, toAuthUser } from "@libs/server/jwt";
import client from "@libs/server/client";
import { hasAdminAccess } from "@libs/server/adminAccess";
import { role as UserRole, UserStatus } from "@prisma/client";
import {
  getAppRuntimeEnv,
  isProductionLikeEnv,
  isTestAccountUser,
} from "@libs/shared/test-accounts";

const TEST_USER_ROLE: UserRole = "FAKE_USER";

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
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
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
  return (
    targetUser.status === "ACTIVE" &&
    (targetUser.role === TEST_USER_ROLE || targetUser.provider === "test_user")
  );
};

const FORBIDDEN_MESSAGE =
  "테스트 계정 기능은 관리자 또는 테스트 계정으로 로그인해야 사용할 수 있어요.";

/**
 * 토큰을 발급하는 경로라 운영 환경에서는 관리자·테스트 계정만 쓸 수 있다
 * (마이페이지 전환 목록과 같은 기준). 개발·프리뷰는 로그인 화면 테스트 로그인을 위해 열어 둔다.
 */
async function canUseTestAccounts(viewerId?: number): Promise<boolean> {
  if (!isProductionLikeEnv(getAppRuntimeEnv())) return true;
  if (!viewerId) return false;

  const viewer = await client.user.findUnique({
    where: { id: viewerId },
    select: { role: true, provider: true },
  });
  if (isTestAccountUser(viewer)) return true;
  return hasAdminAccess(viewerId);
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestAccountsResponse | TestAccountSwitchResponse | TestAccountCreateResponse>
) {
  if (!(await canUseTestAccounts(req.user?.id))) {
    return res.status(403).json({
      success: false,
      error: FORBIDDEN_MESSAGE,
    } satisfies TestAccountSwitchResponse);
  }

  if (req.method === "GET") {
    const users = await client.user.findMany({
      where: {
        OR: [{ role: TEST_USER_ROLE }, { provider: "test_user" }],
        status: "ACTIVE",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        tokenVersion: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "테스트 유저 계정을 찾을 수 없습니다.",
      } satisfies TestAccountSwitchResponse);
    }

    if (!isSwitchableTestUser(targetUser)) {
      return res.status(404).json({
        success: false,
        error: "테스트 유저 계정을 찾을 수 없습니다.",
      } satisfies TestAccountSwitchResponse);
    }

    const switchableUser = targetUser;

    const { accessToken, refreshToken, expiresIn } = await issueTokens(
      toAuthUser(switchableUser),
      switchableUser.tokenVersion
    );

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn,
    } satisfies TestAccountSwitchResponse);
  }

  return res.status(405).json({
    success: false,
    error: "지원하지 않는 메서드입니다.",
    users: [],
  } satisfies TestAccountsResponse);
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
