import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { hasAdminAccess } from "./_utils";

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    session: { user },
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const users = await client.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({ success: true, users });
  }

  if (req.method === "POST") {
    const { userId, action, role } = req.body;

    if (!userId || !action) {
      return res
        .status(400)
        .json({ success: false, error: "필수 파라미터가 누락되었습니다." });
    }

    if (action === "update_role") {
      await client.user.update({
        where: { id: Number(userId) },
        data: { role },
      });
    }

    if (action === "delete") {
      await client.user.delete({
        where: { id: Number(userId) },
      });
    }

    return res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);

