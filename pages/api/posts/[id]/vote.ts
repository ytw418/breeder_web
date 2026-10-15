import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { castDebateVote, DebateError } from "@libs/server/debate";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";

/**
 * POST /api/posts/:id/vote { side: "A" | "B", source? } — 찬반 토론 투표·선택 바꾸기(앱 docs/prd/live-talk.md §4.2).
 * 같은 쪽 다시 → 그대로 200. 끝났으면 409 DEBATE_CLOSED. 응답은 바뀐 요약(막대·참여 수·내 선택).
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const postId = extractPostIdFromPath(String(req.query.id ?? ""));
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }
  const side = req.body?.side;
  if (side !== "A" && side !== "B") {
    return res.status(400).json({ success: false, error: "한쪽을 골라 주세요", errorCode: "DEBATE_SIDE_REQUIRED" });
  }
  const userId = req.user!.id;
  try {
    const before = await client.debateVote.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { side: true },
    });
    const debate = await castDebateVote({ postId, userId, side });
    if (before?.side !== side) {
      await captureServerEvent(userId, "debate_voted", {
        post_id: postId,
        side,
        switched: Boolean(before),
        source: typeof req.body?.source === "string" ? req.body.source : null,
        platform: resolveClientPlatform(req),
      });
    }
    return res.json({ success: true, debate });
  } catch (error) {
    if (error instanceof DebateError) {
      return res.status(error.status).json({ success: false, error: error.message, errorCode: error.errorCode });
    }
    throw error;
  }
}

export default withAuth(withHandler({ methods: ["POST"], handler, isPrivate: true }));
