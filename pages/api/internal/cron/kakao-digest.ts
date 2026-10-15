import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { buildAllKakaoDigests, sendKakaoDigestToSlack } from "@libs/server/kakaoDigest";

interface CronResponse {
  success: boolean;
  sent?: boolean;
  error?: string;
}

/** 매일 아침 8시(KST) 오픈채팅방 소식 문구를 슬랙으로 보낸다. 운영자가 카톡에 붙여넣는다. */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse>
) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;

  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const digests = await buildAllKakaoDigests();
    const sent = await sendKakaoDigestToSlack(digests);
    return res.json({ success: true, sent });
  } catch (error) {
    console.error("[cron][kakao-digest]", error);
    return res.status(500).json({ success: false, error: "오픈채팅 소식 발송에 실패했습니다." });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
