import { promises as fs } from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import type { LandingPageRecord } from "pages/api/admin/landing-pages";

interface LandingPageDetailResponse extends ResponseType {
  page?: LandingPageRecord;
}

const LANDING_PAGES_FILE = path.join(
  process.cwd(),
  "data",
  "admin-landing-pages.json"
);

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LandingPageDetailResponse>
) {
  const { slug } = req.query;
  if (!slug || Array.isArray(slug)) {
    return res.status(400).json({ success: false, error: "slug가 필요합니다." });
  }

  let pages: LandingPageRecord[] = [];
  try {
    const text = await fs.readFile(LANDING_PAGES_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      pages = parsed;
    }
  } catch {
    pages = [];
  }

  const page = pages.find((item) => item.slug === slug && item.isPublished);
  if (!page) {
    return res
      .status(404)
      .json({ success: false, error: "페이지를 찾을 수 없습니다." });
  }

  return res.json({ success: true, page });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
