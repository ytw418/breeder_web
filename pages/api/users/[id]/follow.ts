import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { createNotification } from "@libs/server/notification";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
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

    // 본문 follow(true/false)는 바꿀 상태다. 이미 그 상태면 그대로 둔다 — 화면 값이 낡았을 때
    // '팔로우'를 눌러 언팔로우되던 문제(2026-10-20). 본문이 없는 옛 앱은 지금 상태를 뒤집는다(토글).
    const desired = typeof req.body?.follow === "boolean" ? (req.body.follow as boolean) : null;

    // 이미 팔로우 중인지 확인
    const existing = await client.follow.findFirst({
      where: {
        followerId: myId,
        followingId: targetUserId,
      },
    });

    if (desired !== null && desired === Boolean(existing)) {
      return res.json({ success: true, isFollowing: desired });
    }

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

      // 팔로우 — 같은 쌍은 @@unique 라 동시에 두 번 눌러도 한 행만 생긴다. 늦게 온 요청은 이미 팔로우 중으로 끝낸다(알림 없음).
      try {
        await client.follow.create({
          data: {
            followerId: myId,
            followingId: targetUserId,
          },
        });
      } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
          return res.json({ success: true, isFollowing: true });
        }
        throw error;
      }

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

      await captureServerEvent(myId, "user_followed", {
        target_user_id: targetUserId,
        platform: resolveClientPlatform(req),
      });

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
