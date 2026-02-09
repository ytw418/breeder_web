import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { hasAdminAccess } from "./_utils";
import client from "@libs/server/client";

export interface LandingPageRecord {
  id: number;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const slugRegex = /^[a-z0-9-]+$/;

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
    const pages = await client.landingPage.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return res.json({
      success: true,
      pages,
    });
  }

  if (req.method === "POST") {
    const { action = "create", id, slug, title, content, isPublished = true } =
      req.body;

    if (action === "create") {
      if (!slug || !title || !content) {
        return res
          .status(400)
          .json({ success: false, error: "slug, title, content는 필수입니다." });
      }

      const normalizedSlug = String(slug).trim().toLowerCase();
      if (!slugRegex.test(normalizedSlug)) {
        return res.status(400).json({
          success: false,
          error: "slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.",
        });
      }

      const exists = await client.landingPage.findUnique({
        where: { slug: normalizedSlug },
      });
      if (exists) {
        return res
          .status(400)
          .json({ success: false, error: "이미 존재하는 slug입니다." });
      }

      const nextPage = await client.landingPage.create({
        data: {
          slug: normalizedSlug,
          title: String(title).trim(),
          content: String(content),
          isPublished: Boolean(isPublished),
        },
      });

      return res.json({ success: true, page: nextPage });
    }

    if (action === "update") {
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "id가 필요합니다." });
      }

      const target = await client.landingPage.findUnique({
        where: { id: Number(id) },
      });
      if (!target) {
        return res
          .status(404)
          .json({ success: false, error: "페이지를 찾을 수 없습니다." });
      }

      const nextSlug =
        typeof slug === "string" ? slug.trim().toLowerCase() : target.slug;
      if (!slugRegex.test(nextSlug)) {
        return res.status(400).json({
          success: false,
          error: "slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.",
        });
      }

      const slugConflict = await client.landingPage.findFirst({
        where: {
          slug: nextSlug,
          NOT: { id: Number(id) },
        },
      });
      if (slugConflict) {
        return res
          .status(400)
          .json({ success: false, error: "이미 존재하는 slug입니다." });
      }

      const updated = await client.landingPage.update({
        where: { id: Number(id) },
        data: {
          slug: nextSlug,
          title: typeof title === "string" ? title.trim() : target.title,
          content: typeof content === "string" ? content : target.content,
          isPublished:
            typeof isPublished === "boolean" ? isPublished : target.isPublished,
        },
      });

      return res.json({ success: true, page: updated });
    }

    return res
      .status(400)
      .json({ success: false, error: "지원하지 않는 action 입니다." });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: "id가 필요합니다." });
    }

    const target = await client.landingPage.findUnique({
      where: { id: Number(id) },
    });
    if (!target) {
      return res
        .status(404)
        .json({ success: false, error: "페이지를 찾을 수 없습니다." });
    }

    await client.landingPage.delete({ where: { id: Number(id) } });
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
