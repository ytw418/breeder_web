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
            { title: { contains: String(keyword) } },
            { description: { contains: String(keyword) } },
            { user: { name: { contains: String(keyword) } } },
          ],
        }
      : {};

    const [posts, totalCount] = await Promise.all([
      client.post.findMany({
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
              Likes: true,
              comments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip,
      }),
      client.post.count({ where }),
    ]);

    return res.json({
      success: true,
      posts,
      totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  }

  if (req.method === "POST") {
    const { action, title, description, image } = req.body;

    if (action !== "create_notice") {
      return res
        .status(400)
        .json({ success: false, error: "지원하지 않는 action 입니다." });
    }

    if (!title || !description) {
      return res
        .status(400)
        .json({ success: false, error: "제목과 내용을 입력해주세요." });
    }

    const normalizedTitle = String(title).trim();
    const finalTitle = normalizedTitle.startsWith("[공지]")
      ? normalizedTitle
      : `[공지] ${normalizedTitle}`;

    const post = await client.post.create({
      data: {
        title: finalTitle,
        description: String(description),
        image: image || "",
        category: "공지",
        user: {
          connect: {
            id: user?.id,
          },
        },
      },
    });

    return res.json({ success: true, post });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID가 필요합니다." });
    }

    await client.post.delete({
      where: { id: Number(id) },
    });

    return res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST", "DELETE"],
    isPrivate: false,
    handler,
  })
);
