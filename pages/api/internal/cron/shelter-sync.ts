import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { resolveCategoryIdByName } from "@libs/server/categories";
import { runShelterSync, SHELTER_MAX_NEW_PER_RUN } from "@libs/server/shelterSync";

/**
 * 보호소 아이들 동기화(앱 docs/prd/shelter-animals.md F-1·F-2).
 * GitHub Actions(.github/workflows/shelter-sync.yml)가 3시간마다 부른다. 겹쳐 불러도 같은 공고를 두 번 넣지 않는다(고유 색인).
 * 새 공고는 회차당 150건까지(처음 채우기는 여러 회차에 나뉜다). 손으로 더 넣으려면 ?maxNew=400 (최대 500, 시간 한도 50초가 먼저 걸린다).
 * 환경 변수: CRON_SECRET, DATA_GO_KR_KEY(공공데이터포털 인증키), SHELTER_USER_ID(보호소 소식 계정 id).
 */
export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const apiKey = process.env.DATA_GO_KR_KEY;
  const userId = Number(process.env.SHELTER_USER_ID);
  if (!apiKey || !Number.isInteger(userId) || userId <= 0) {
    return res.status(500).json({
      success: false,
      error: "DATA_GO_KR_KEY 와 SHELTER_USER_ID(보호소 소식 계정 id) 환경 변수가 필요합니다.",
    });
  }

  const rawMax = Number(req.query.maxNew);
  const maxNew = Number.isInteger(rawMax) && rawMax > 0 ? Math.min(rawMax, 500) : SHELTER_MAX_NEW_PER_RUN;

  try {
    const author = await client.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!author) {
      return res.status(500).json({ success: false, error: `SHELTER_USER_ID ${userId} 계정을 찾을 수 없습니다.` });
    }
    const result = await runShelterSync({ db: client, apiKey, userId, maxNew, resolveCategoryId: resolveCategoryIdByName });
    return res.json({ success: result.ok, ...result });
  } catch (error) {
    console.error("[cron][shelter-sync]", error);
    return res.status(500).json({ success: false, error: "보호소 아이들 동기화에 실패했습니다." });
  }
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
