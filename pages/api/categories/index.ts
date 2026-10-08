import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { getVisibleCategories } from "@libs/server/categories";
import { CategoriesResponse } from "@libs/shared/categories";

/**
 * 관심 카테고리 트리(노출 카테고리만, 부모 → 자식 순 평면 목록). 앱 온보딩·설정·홈 범위 표시가 쓴다.
 * 트리 구조는 parentId/path 로 클라이언트가 만든다. DB 에 행을 추가하면 앱 수정 없이 바로 노출된다.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CategoriesResponse>
) {
  try {
    const categories = await getVisibleCategories();
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json({ success: true, categories });
  } catch (error) {
    console.error("[categories]", error);
    return res.status(500).json({
      success: false,
      categories: [],
      error: "카테고리를 불러오지 못했습니다.",
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
