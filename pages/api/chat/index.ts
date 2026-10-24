import withHandler from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@libs/server/auth";
import { assertCanChat } from "@libs/server/blocks";
import { resolveClientPlatform } from "@libs/server/analytics";
import { findDirectRoomId, findOrCreateDirectRoom } from "@libs/server/chatRoom";
import { assertWriteAllowed } from "@libs/server/writeLimits";

export interface ChatRequestType {
  otherId: number;
}

export interface ChatResponseType {
  success: boolean;
  error?: string;
  errorCode?: string;
  ChatRoomId?: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponseType>
) {
  try {
    const {
      user,
      body: { otherId },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    if (!otherId) {
      return res
        .status(400)
        .json({ success: false, error: "상대방 정보가 없습니다." });
    }

    // 자기 자신과 채팅 방지
    if (user.id === +otherId) {
      return res
        .status(400)
        .json({ success: false, error: "자기 자신과는 채팅할 수 없습니다." });
    }

    // 보호소 공고를 올리는 소식 계정(SHELTER_USER_ID)과는 채팅하지 않는다. 보호소로 직접 문의한다.
    const shelterUserId = Number(process.env.SHELTER_USER_ID);
    if (Number.isInteger(shelterUserId) && shelterUserId > 0 && +otherId === shelterUserId) {
      return res
        .status(400)
        .json({ success: false, error: "보호소 공고는 보호소로 문의해 주세요", errorCode: "SHELTER_PRODUCT" });
    }

    // 차단(양방향)·탈퇴한 상대와는 방을 만들거나 열지 않는다.
    const canChat = await assertCanChat(user.id, +otherId);
    if (!canChat.ok) {
      return res
        .status(canChat.status)
        .json({ success: false, error: canChat.error, errorCode: canChat.errorCode });
    }

    // 이미 있는 방은 그대로 연다. 새 방만 가입 7일 미만 하루 5개로 센다(감사 24번).
    const existingId = await findDirectRoomId(user.id, +otherId);
    if (existingId) return res.json({ success: true, ChatRoomId: existingId });
    const writeLimit = await assertWriteAllowed({ userId: user.id, kind: "chatRoom" });
    if (writeLimit) {
      return res
        .status(writeLimit.status)
        .json({ success: false, error: writeLimit.error, errorCode: writeLimit.errorCode });
    }

    const room = await findOrCreateDirectRoom(user.id, +otherId, resolveClientPlatform(req));
    return res.json({ success: true, ChatRoomId: room.id });
  } catch (error) {
    console.error("Error in chat handler:", error);
    return res.status(500).json({
      success: false,
      error: "채팅방 생성 중 오류가 발생했습니다.",
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
