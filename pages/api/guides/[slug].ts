import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { getGuideDetail } from "@libs/server/guides";
import type { GuideDetailResponse } from "@libs/shared/guides";

/**
 * GET /api/guides/:slug — 가이드 본문 + 그 종의 회원 글·분양 중·혈통 수(앱 docs/prd/species-guide.md).
 * 없는 slug·공개 전(draft)은 404. 회원 데이터 조회 실패는 community: null 로 200(본문은 보인다).
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType | GuideDetailResponse>) {
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  const detail = slug ? await getGuideDetail(slug) : null;
  if (!detail) return res.status(404).json({ success: false, message: "가이드를 찾을 수 없습니다." });
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.json(detail);
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
