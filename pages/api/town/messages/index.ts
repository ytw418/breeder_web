import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { listTownMessages, sendTownMessage, TownError } from "@libs/server/townTalk";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";

const cursor = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * 동네 사랑방 메시지(앱 docs/prd/live-talk.md §3.4·§4.2).
 * GET ?after=<id>|before=<id>&limit= — 반경 50km 이웃의 최근 7일 메시지(오래된 → 최신). 화면이 열려 있는 동안 3초마다 after.
 * POST { type, body, image?, productId?, replyToId? } — 보내기(금칙어·연락처 가림·5초에 1개·하루 200개).
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const viewerId = req.user!.id;
  if (req.method === "GET") {
    const limit = Number(req.query.limit);
    const result = await listTownMessages({
      viewerId,
      after: cursor(req.query.after),
      before: cursor(req.query.before),
      limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : undefined,
    });
    return res.json(result);
  }
  try {
    const message = await sendTownMessage({ viewerId, ...req.body });
    await captureServerEvent(viewerId, "town_message_sent", {
      type: message.type,
      is_newcomer: message.user.isNewcomer,
      from_prompt: Boolean(req.body?.fromPrompt),
      platform: resolveClientPlatform(req),
    });
    return res.json({ success: true, townMessage: message });
  } catch (error) {
    if (error instanceof TownError) {
      return res.status(error.status).json({ success: false, error: error.message, errorCode: error.errorCode });
    }
    throw error;
  }
}

export default withAuth(withHandler({ methods: ["GET", "POST"], handler, isPrivate: true }));
