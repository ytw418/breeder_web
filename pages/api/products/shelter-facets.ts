import { NextApiRequest, NextApiResponse } from "next";

import { withAuth } from "@libs/server/auth";
import { getShelterFacets } from "@libs/server/shelterFacets";
import withHandler, { ResponseType } from "@libs/server/withHandler";

/**
 * 보호소 아이들 필터 시트 숫자. GET /api/products/shelter-facets?category=강아지|고양이&sido=경기도
 * → { success, total, sido[{name,short,count}], sigungu[{name,count}](sido 가 있을 때), breed[{name,count}](category 가 있을 때) }.
 * 로그인과 상관없는 공개 집계라 목록과 달리 viewer 별 응답이 없다(공유 캐시 5분).
 */
const handler = async (req: NextApiRequest, res: NextApiResponse<ResponseType>) => {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim();
  const category = first(req.query.category);
  const sido = first(req.query.sido);
  const facets = await getShelterFacets({
    category: category === "강아지" || category === "고양이" ? category : undefined,
    sido: sido && sido.length <= 40 ? sido : undefined,
  });
  return res.json(facets);
};

export default withAuth(withHandler({ methods: ["GET"], isPrivate: false, handler }));
