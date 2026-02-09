import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { User } from "@prisma/client";

export interface UserResponse {
  success: boolean;
  user?: User & {
    _count: {
      followers: number;
      following: number;
      products: number;
      posts: number;
      Comments: number;
      insectRecords: number;
      receivedReviews: number;
    };
  };
  isFollowing?: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (!req.query.id) {
    return res.status(400).json({
      success: false,
      message: "query에 id가 없습니다.",
    });
  }

  const userId = +req.query.id;
  const myId = req.session.user?.id;

  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          followers: true,
          following: true,
          products: true,
          posts: true,
          Comments: true,
          insectRecords: true,
          receivedReviews: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "유저를 찾을 수 없습니다.",
    });
  }

  // 현재 로그인한 유저가 해당 유저를 팔로우하고 있는지 확인
  let isFollowing = false;
  if (myId && myId !== userId) {
    const follow = await client.follow.findFirst({
      where: {
        followerId: myId,
        followingId: userId,
      },
    });
    isFollowing = !!follow;
  }

  return res.json({ success: true, user, isFollowing });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
