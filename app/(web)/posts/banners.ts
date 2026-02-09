import { NextApiRequest, NextApiResponse } from "next";
import client from "@libs/server/client";
import { withSessionRoute } from "@libs/server/withSession";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req.session;

  // 어드민 권한 체크 (실제 구현 시 미들웨어로 분리 권장)
  const dbUser = await client.user.findUnique({ where: { id: user?.id } });
  if (!dbUser || dbUser.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const banners = await client.banner.findMany({
      orderBy: { order: "asc" },
    });
    return res.json({ success: true, banners });
  }

  if (req.method === "POST") {
    const { title, description, image, href, bgClass, order } = req.body;
    const banner = await client.banner.create({
      data: {
        title,
        description,
        image,
        href,
        bgClass,
        order: Number(order) || 0,
      },
    });
    return res.json({ success: true, banner });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await client.banner.delete({
      where: { id: Number(id) },
    });
    return res.json({ success: true });
  }

  return res.status(405).end();
}

export default withSessionRoute(handler);