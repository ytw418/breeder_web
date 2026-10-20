import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import type { LandingPageRecord } from "pages/api/admin/landing-pages";
import client from "@libs/server/client";
import { DEFAULT_LANDING_PAGES } from "@libs/server/defaultLandingPages";

interface LandingPageDetailResponse extends ResponseType {
  page?: LandingPageRecord;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LandingPageDetailResponse>
) {
  const { slug } = req.query;
  if (!slug || Array.isArray(slug)) {
    return res.status(400).json({ success: false, error: "slug가 필요합니다." });
  }

  const page = await client.landingPage.findFirst({
    where: { slug, isPublished: true },
  });
  if (!page) {
    // 관리자가 아직 올리지 않은 기본 문서(이용 규칙 등)는 서버가 가진 기본본을 준다.
    const fallback = DEFAULT_LANDING_PAGES[slug];
    if (fallback) {
      return res.json({
        success: true,
        page: {
          id: 0,
          slug: fallback.slug,
          title: fallback.title,
          content: fallback.content,
          isPublished: true,
          createdAt: fallback.updatedAt,
          updatedAt: fallback.updatedAt,
        },
      });
    }
    return res
      .status(404)
      .json({ success: false, error: "페이지를 찾을 수 없습니다." });
  }

  return res.json({ success: true, page });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
