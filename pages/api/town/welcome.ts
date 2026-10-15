import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { TownError, welcomeTownNeighbor } from "@libs/server/townTalk";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";

/** POST /api/town/welcome { userId } — 새로 온 이웃 반겨 주기(한 사람에게 한 번, 답장 + 알림). */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const targetUserId = Number(req.body?.userId);
  if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ success: false, error: "반겨 줄 이웃을 찾을 수 없어요" });
  }
  try {
    const message = await welcomeTownNeighbor(req.user!.id, targetUserId);
    await captureServerEvent(req.user!.id, "town_welcome_sent", { platform: resolveClientPlatform(req) });
    return res.json({ success: true, townMessage: message });
  } catch (error) {
    if (error instanceof TownError) {
      return res.status(error.status).json({ success: false, error: error.message, errorCode: error.errorCode });
    }
    throw error;
  }
}

export default withAuth(withHandler({ methods: ["POST"], handler, isPrivate: true }));
