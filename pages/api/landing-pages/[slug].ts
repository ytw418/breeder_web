import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import type { LandingPageRecord } from "pages/api/admin/landing-pages";
import client from "@libs/server/client";

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
