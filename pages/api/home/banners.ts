import { NextApiRequest, NextApiResponse } from "next";

import withHandler from "@libs/server/withHandler";
import { fetchHomeBanners } from "@libs/server/home";
import { HomeBanner } from "@libs/shared/home";

export interface HomeBannersResponse {
  success: boolean;
  banners: HomeBanner[];
}

/** 홈 상단 배너(관리자 배너, 없으면 샘플). 웹 홈은 SSR 로 같은 데이터를 받고, 앱은 이 API 를 쓴다. */
async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HomeBannersResponse>
) {
  try {
    const banners = await fetchHomeBanners();

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=120"
    );

    return res.json({ success: true, banners });
  } catch (error) {
    console.error("[home][banners]", error);
    return res.status(500).json({ success: false, banners: [] });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
