import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { createNotification } from "@libs/server/notification";
import { FOLLOW_BLOCKED_MESSAGE, getBlockRelation } from "@libs/server/blocks";

export interface FollowResponse {
  success: boolean;
  isFollowing: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  try {
    const targetUserId = +req.query.id!;
    const myId = req.user?.id;

    if (!myId) {
      return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
    }

    if (myId === targetUserId) {
      return res.status(400).json({ success: false, error: "자기 자신을 팔로우할 수 없습니다." });
    }

    // 이미 팔로우 중인지 확인
    const existing = await client.follow.findFirst({
      where: {
        followerId: myId,
        followingId: targetUserId,
      },
    });

    if (existing) {
      // 언팔로우
      await client.follow.delete({ where: { id: existing.id } });
      return res.json({ success: true, isFollowing: false });
    } else {
      // 차단하면 양방향 팔로우를 지우므로, 차단 관계에서는 새 팔로우(와 그 알림)도 막는다.
      const relation = await getBlockRelation(myId, targetUserId);
      if (relation.blockedByMe || relation.blockedMe) {
        return res.status(403).json({
          success: false,
          error: FOLLOW_BLOCKED_MESSAGE,
          errorCode: "FOLLOW_BLOCKED",
        });
      }

      // 팔로우
      await client.follow.create({
        data: {
          followerId: myId,
          followingId: targetUserId,
        },
      });

      // 팔로우 알림 생성
      const senderUser = await client.user.findUnique({
        where: { id: myId },
        select: { name: true },
      });

      if (senderUser) {
        await createNotification({
          type: "FOLLOW",
          userId: targetUserId,
          senderId: myId,
          message: `${senderUser.name}님이 회원님을 팔로우했습니다.`,
          targetId: myId,
          targetType: "user",
        });
      }

      return res.json({ success: true, isFollowing: true });
    }
  } catch (error) {
    console.error("Follow error:", error);
    return res.status(500).json({ success: false, error: "팔로우 처리 중 오류가 발생했습니다." });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
