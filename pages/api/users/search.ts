import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";

interface UserSearchResponse {
  success: boolean;
  users: Array<{
    id: number;
    name: string;
  }>;
  error?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse<UserSearchResponse>) {
  const userId = req.session.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      users: [],
      error: "로그인이 필요합니다.",
    });
  }

  if (req.method !== "GET") {
    return;
  }

  const keyword = String(req.query.q || "").trim();
  if (keyword.length < 1) {
    return res.json({ success: true, users: [] });
  }

  const excludedSelf = String(req.query.excludeSelf || "true") !== "false";
  const rawLimit = Number(req.query.limit);
  const limit = Number.isNaN(rawLimit) ? 8 : Math.max(1, Math.min(rawLimit, 20));

  const users = await client.user.findMany({
    where: {
      status: "ACTIVE",
      name: { contains: keyword, mode: "insensitive" },
      ...(excludedSelf ? { NOT: { id: userId } } : {}),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return res.json({
    success: true,
    users: users.map((item) => ({ id: item.id, name: item.name })),
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
