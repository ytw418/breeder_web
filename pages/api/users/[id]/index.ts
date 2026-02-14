import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { User } from "@prisma/client";

type UserWithCounts = User & {
  _count: {
    followers: number;
    following: number;
    products: number;
    posts: number;
    Comments: number;
    insectRecords: number;
    receivedReviews: number;
  };
  maskedEmail?: string | null;
};

export interface UserResponse {
  success: boolean;
  user?: UserWithCounts;
  isFollowing?: boolean;
}

function maskEmail(email?: string | null) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;

  const [local = "", domain = ""] = value.split("@");
  const [domainHead = "", ...domainRest] = domain.split(".");

  if (!local || !domainHead) return null;

  const localMasked =
    local.length <= 2
      ? `${local.slice(0, 1)}*`
      : `${local.slice(0, 2)}${"*".repeat(Math.min(6, Math.max(3, local.length - 2)))}`;

  const domainHeadMasked =
    domainHead.length <= 1
      ? `${domainHead}*`
      : `${domainHead.slice(0, 1)}${"*".repeat(Math.min(5, Math.max(3, domainHead.length - 1)))}`;

  return `${localMasked}@${domainHeadMasked}${
    domainRest.length ? `.${domainRest.join(".")}` : ""
  }`;
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

  const safeUser: UserWithCounts =
    myId === userId
      ? { ...user, maskedEmail: maskEmail(user.email) }
      : { ...user, email: null, maskedEmail: maskEmail(user.email) };

  return res.json({ success: true, user: safeUser, isFollowing });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
