import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { role as UserRole } from "@prisma/client";
import { hasAdminAccess } from "./_utils";

const ROLE_OPTIONS: UserRole[] = ["USER", "ADMIN", "SUPER_USER"];

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
      if (!role || !ROLE_OPTIONS.includes(role)) {
        return res
          .status(400)
          .json({ success: false, error: "유효하지 않은 권한 값입니다." });
      }

      await client.user.update({
        where: { id: Number(userId) },
        data: { role },
      });

      return res.json({ success: true });
    }

    if (action === "delete") {
      if (Number(userId) === user?.id) {
        return res
          .status(400)
          .json({ success: false, error: "현재 로그인한 계정은 삭제할 수 없습니다." });
      }

      await client.user.delete({
        where: { id: Number(userId) },
      });

      return res.json({ success: true });
    }

    return res
      .status(400)
      .json({ success: false, error: "지원하지 않는 action 입니다." });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
