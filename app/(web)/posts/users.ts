import { NextApiRequest, NextApiResponse } from "next";
import client from "@libs/server/client";
import { withSessionRoute } from "@libs/server/withSession";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req.session;

  const dbUser = await client.user.findUnique({ where: { id: user?.id } });
  if (!dbUser || dbUser.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const users = await client.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50, // 페이지네이션 필요 시 수정
    });
    return res.json({ success: true, users });
  }

  if (req.method === "POST") {
    // 권한 변경 또는 삭제
    const { userId, action, role } = req.body;
    
    if (action === "update_role") {
      await client.user.update({
        where: { id: Number(userId) },
        data: { role },
      });
    }

    if (action === "delete") {
      // 실제 삭제 대신 soft delete를 권장하지만 여기선 예시로 삭제
      await client.user.delete({
        where: { id: Number(userId) },
      });
    }

    return res.json({ success: true });
  }

  return res.status(405).end();
}

export default withSessionRoute(handler);