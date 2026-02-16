import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";

const TEST_USER_PROVIDERS = ["test_user", "seed"] as const;
const TEST_ACCOUNT_LIMIT = 5;

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

const isTestUserProvider = (provider?: string | null) =>
  typeof provider === "string" &&
  TEST_USER_PROVIDERS.includes(provider as (typeof TEST_USER_PROVIDERS)[number]);

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
        provider: { in: [...TEST_USER_PROVIDERS] },
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
    const targetUserId = Number(req.body?.userId);

    if (!targetUserId || Number.isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: "전환할 유저 ID가 필요합니다.",
      } satisfies TestAccountSwitchResponse);
    }

    const targetUser = await client.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || !isTestUserProvider(targetUser.provider)) {
      return res.status(404).json({
        success: false,
        error: "테스트 유저 계정을 찾을 수 없습니다.",
      } satisfies TestAccountSwitchResponse);
    }

    if (targetUser.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        error: "비활성 계정으로는 전환할 수 없습니다.",
      } satisfies TestAccountSwitchResponse);
    }

    req.session.user = targetUser;
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
