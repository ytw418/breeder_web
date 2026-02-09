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
    const { page = 1, limit = 20, keyword } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = keyword
      ? {
          OR: [
            { name: { contains: String(keyword) } },
            { description: { contains: String(keyword) } },
            { user: { name: { contains: String(keyword) } } },
          ],
        }
      : {};

    const [products, totalCount] = await Promise.all([
      client.product.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              favs: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip,
      }),
      client.product.count({ where }),
    ]);

    return res.json({
      success: true,
      products,
      totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID가 필요합니다." });
    }

    await client.product.delete({
      where: { id: Number(id) },
    });

    return res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "DELETE"],
    isPrivate: false,
    handler,
  })
);

