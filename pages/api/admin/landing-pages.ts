import { promises as fs } from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { hasAdminAccess } from "./_utils";

export interface LandingPageRecord {
  id: number;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const LANDING_PAGES_FILE = path.join(DATA_DIR, "admin-landing-pages.json");

const slugRegex = /^[a-z0-9-]+$/;

async function readLandingPages(): Promise<LandingPageRecord[]> {
  try {
    const text = await fs.readFile(LANDING_PAGES_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed as LandingPageRecord[];
  } catch {
    return [];
  }
}

async function writeLandingPages(pages: LandingPageRecord[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LANDING_PAGES_FILE, JSON.stringify(pages, null, 2), "utf-8");
}

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
    const pages = await readLandingPages();
    return res.json({
      success: true,
      pages: pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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

      const pages = await readLandingPages();
      if (pages.some((page) => page.slug === normalizedSlug)) {
        return res
          .status(400)
          .json({ success: false, error: "이미 존재하는 slug입니다." });
      }

      const now = new Date().toISOString();
      const nextPage: LandingPageRecord = {
        id: Date.now(),
        slug: normalizedSlug,
        title: String(title).trim(),
        content: String(content),
        isPublished: Boolean(isPublished),
        createdAt: now,
        updatedAt: now,
      };

      await writeLandingPages([...pages, nextPage]);
      return res.json({ success: true, page: nextPage });
    }

    if (action === "update") {
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "id가 필요합니다." });
      }

      const pages = await readLandingPages();
      const target = pages.find((page) => page.id === Number(id));
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

      const slugConflict = pages.find(
        (page) => page.slug === nextSlug && page.id !== Number(id)
      );
      if (slugConflict) {
        return res
          .status(400)
          .json({ success: false, error: "이미 존재하는 slug입니다." });
      }

      const updated: LandingPageRecord = {
        ...target,
        slug: nextSlug,
        title: typeof title === "string" ? title.trim() : target.title,
        content: typeof content === "string" ? content : target.content,
        isPublished:
          typeof isPublished === "boolean" ? isPublished : target.isPublished,
        updatedAt: new Date().toISOString(),
      };

      const nextPages = pages.map((page) =>
        page.id === updated.id ? updated : page
      );
      await writeLandingPages(nextPages);
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

    const pages = await readLandingPages();
    const nextPages = pages.filter((page) => page.id !== Number(id));
    await writeLandingPages(nextPages);
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
