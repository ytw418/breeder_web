import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

export interface MuteChatRoomResponse {
  success: boolean;
  error?: string;
  muted?: boolean;
}

/**
 * POST /api/chat/:chatRoomId/mute { muted } — 이 채팅방 알림 끄기·켜기(앱 docs/prd/chat-room-settings.md).
 * 끄면 이 방 새 메시지 푸시를 보내지 않고 하단 탭 채팅 숫자에서 뺀다. 메시지와 목록의 안 읽음 숫자는 그대로다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<MuteChatRoomResponse>) {
  try {
    const {
      query: { chatRoomId },
      body,
      user,
    } = req;

    if (!user?.id) {
      return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
    }

    const roomId = Number(chatRoomId);
    if (!Number.isInteger(roomId)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 채팅방 ID입니다." });
    }
    const muted = body?.muted;
    if (typeof muted !== "boolean") {
      return res.status(400).json({ success: false, error: "muted 값이 필요합니다." });
    }

    const key = { userId_chatRoomId: { userId: user.id, chatRoomId: roomId } };
    const member = await client.chatRoomMember.findUnique({ where: key, select: { id: true } });
    if (!member) {
      return res.status(404).json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    await client.chatRoomMember.update({
      where: key,
      data: { mutedAt: muted ? new Date() : null },
    });

    return res.json({ success: true, muted });
  } catch (error) {
    console.error("Error in mute chat room handler:", error);
    return res.status(500).json({ success: false, error: "알림 설정을 바꾸지 못했어요." });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
