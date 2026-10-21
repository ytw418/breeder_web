import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { getBlockedUserIds } from "@libs/server/blocks";
import { unreadSince } from "@libs/server/chatRoom";

export interface UnreadCountResponse {
  success: boolean;
  error?: string;
  unreadCount: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnreadCountResponse>
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다.", unreadCount: 0 });
    }

    // 내가 차단한 사람이 있는 방은 unread 에서도 뺀다(채팅 목록과 같은 기준).
    const blockedIds = await getBlockedUserIds(userId);

    // 현재 유저가 속한 채팅방 멤버 정보 조회. 알림을 끈 방은 하단 탭 숫자에서 뺀다(목록에는 회색으로 남는다).
    // 메시지가 없는 방은 목록에서 빠지므로 여기서도 뺀다(채팅 목록과 같은 기준).
    const memberships = await client.chatRoomMember.findMany({
      where: {
        userId,
        mutedAt: null,
        chatRoom: {
          messages: { some: {} },
          ...(blockedIds.length
            ? { chatRoomMembers: { none: { userId: { in: blockedIds } } } }
            : {}),
        },
      },
      select: {
        chatRoomId: true,
        lastReadAt: true,
        leftAt: true,
      },
    });

    // 각 채팅방별 안 읽은 메시지 수를 DB 레벨에서 카운트(분양글 카드 행은 채팅 목록과 같이 빼고 센다)
    let totalUnreadCount = 0;

    for (const membership of memberships) {
      const since = unreadSince(membership);
      const count = await client.message.count({
        where: {
          chatRoomId: membership.chatRoomId,
          userId: { not: userId },
          productId: null,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
      });
      totalUnreadCount += count;
    }

    return res.json({ success: true, unreadCount: totalUnreadCount });
  } catch (error) {
    console.error("Error in unread count handler:", error);
    return res.status(500).json({
      success: false,
      error: "읽지 않은 메시지 수를 불러오는데 실패했습니다.",
      unreadCount: 0,
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
