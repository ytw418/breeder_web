import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { previewTownMessages } from "@libs/server/townTalk";

/** GET /api/town/preview — 홈 동네 섹션 사랑방 줄(최근 3개, 앱 docs/prd/live-talk.md §3.4c). 비로그인은 scope null. */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (!req.user?.id) return res.json({ success: true, scope: null, messages: [], empty: true });
  return res.json(await previewTownMessages(req.user.id));
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: false }));
