import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import {
  getNearbyBreeders,
  NEARBY_LIMIT_DEFAULT,
  NEARBY_LIMIT_MAX,
  type NearbyBreedersResult,
} from "@libs/server/nearby";

/** GET /api/users/nearby?limit=3 — 조회자와 같은 동네의 '나를 표시' 브리더(+ 범위 인원·팔로우 여부·주력 종). 로그인 전용이라 캐시하지 않는다. */
export interface NearbyBreedersResponse extends NearbyBreedersResult {
  success: boolean;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const viewerId = req.user?.id;
  if (!viewerId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  const raw = Number(req.query.limit);
  const limit = Number.isInteger(raw)
    ? Math.min(Math.max(raw, 1), NEARBY_LIMIT_MAX)
    : NEARBY_LIMIT_DEFAULT;

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const result = await getNearbyBreeders({ viewerId, limit });
  return res.json({ success: true, ...result });
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: true }));
