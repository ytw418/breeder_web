import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

export interface LeaveChatRoomResponse {
  success: boolean;
  error?: string;
}

/**
 * POST /api/chat/:chatRoomId/leave — 채팅방 나가기(앱 docs/prd/chat-room-settings.md).
 * 나만 지운다: 방·메시지는 그대로 두고 내 멤버에 나간 시각을 적는다. 상대에게는 알리지 않는다.
 * 나간 시각 전 메시지는 내 화면에서 사라지고, 상대가 다시 보내면 방이 내 목록에 다시 나타난다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<LeaveChatRoomResponse>) {
  try {
    const {
      query: { chatRoomId },
      user,
    } = req;

    if (!user?.id) {
      return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
    }

    const roomId = Number(chatRoomId);
    if (!Number.isInteger(roomId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 채팅방 ID입니다." });
    }

    const key = { userId_chatRoomId: { userId: user.id, chatRoomId: roomId } };
    const member = await client.chatRoomMember.findUnique({ where: key, select: { id: true } });
    if (!member) {
      return res.status(404).json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // 나간 시각까지 읽은 것으로 둔다(안 읽음 0, 상대 화면의 '1' 도 사라진다).
    const now = new Date();
    await client.chatRoomMember.update({
      where: key,
      data: { leftAt: now, lastReadAt: now },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error in leave chat room handler:", error);
    return res.status(500).json({ success: false, error: "채팅방을 나가지 못했어요." });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
