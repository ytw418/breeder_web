import type { NextApiRequest, NextApiResponse } from "next";

import { withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";
import { resolveClientPlatform } from "@libs/server/analytics";
import { sendWave } from "@libs/server/chatWave";
import { waveErrorMessage } from "@libs/shared/chatWave";

export interface WaveResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  chatRoomId?: number;
  messageId?: number;
  wavesLeftToday?: number;
}

/** POST /api/chat/wave { otherId, presetId } — 동네 브리더에게 손 흔들어 인사(libs/shared/chatWave.ts). */
async function handler(req: NextApiRequest, res: NextApiResponse<WaveResponse>) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  try {
    const result = await sendWave({
      senderId: userId,
      otherId: Number(req.body?.otherId),
      presetId: req.body?.presetId,
      platform: resolveClientPlatform(req),
    });
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        errorCode: result.errorCode,
        error: result.error ?? waveErrorMessage(result.errorCode),
        chatRoomId: result.chatRoomId,
        wavesLeftToday: result.wavesLeftToday,
      });
    }
    return res.json({
      success: true,
      chatRoomId: result.chatRoomId,
      messageId: result.messageId,
      wavesLeftToday: result.wavesLeftToday,
    });
  } catch (error) {
    console.error("Error in wave handler:", error);
    return res.status(500).json({ success: false, error: waveErrorMessage(null) });
  }
}

export default withAuth(withHandler({ methods: ["POST"], handler, isPrivate: true }));
