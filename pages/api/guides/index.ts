import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { getGuideList } from "@libs/server/guides";
import type { GuideListResponse } from "@libs/shared/guides";

/** GET /api/guides — 공개된 종별 사육 가이드 목록(분류표 순서). 앱 가이드 목록·진입 행이 쓴다. */
async function handler(_req: NextApiRequest, res: NextApiResponse<ResponseType | GuideListResponse>) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.json(await getGuideList());
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
