import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";

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
    const myId = req.session.user?.id;

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

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
