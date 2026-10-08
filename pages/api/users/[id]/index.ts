import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import {
  getActiveBreederProgramsByUserId,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { withAuth } from "@libs/server/auth";
import { parsePositiveIntId } from "@libs/shared/normalize";
import { countProfileBloodlineCards } from "@libs/server/bloodline-visibility";
import { User } from "@prisma/client";

type UserWithCounts = Omit<User, "tokenVersion" | "suspendedUntil" | "snsId" | "phone"> & {
  /** 본인 조회일 때만 내려준다(로그인 식별자·연락처). */
  snsId?: string;
  phone?: string | null;
  _count: {
    followers: number;
    following: number;
    products: number;
    posts: number;
    Comments: number;
    insectRecords: number;
    receivedReviews: number;
    createdBloodlineCards: number;
    ownedBloodlineCards: number;
  };
  maskedEmail?: string | null;
  badges?: Array<{
    id: number;
    badgeType: string;
    rank: number;
    label: string;
    createdAt: string;
  }>;
  breederPrograms?: BreederProgramSummary[];
};

export interface UserResponse {
  success: boolean;
  user?: UserWithCounts;
  isFollowing?: boolean;
  /** 로그인한 viewer 가 이 유저를 차단했는지(단방향). 상대가 나를 차단한 사실은 노출하지 않는다. */
  isBlocked?: boolean;
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

  // 숫자가 아닌 id(예: 정적 라우트가 없는 배포에서 /api/users/check-name)는 Prisma 오류 대신 404.
  const userId = parsePositiveIntId(req.query.id);
  if (!userId) {
    return res.status(404).json({
      success: false,
      message: "유저를 찾을 수 없습니다.",
    });
  }
  const myId = req.user?.id;

  const [user, ownedBloodlineCards] = await Promise.all([
    client.user.findUnique({
      where: { id: userId },
      // 토큰 무효화·정지 만료 같은 서버 내부 필드는 내려주지 않는다.
      omit: { tokenVersion: true, suspendedUntil: true },
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
            // 삭제한 상품은 세지 않는다(상품 삭제는 isDeleted 소프트 삭제).
            products: { where: { isDeleted: false } },
            posts: true,
            Comments: true,
            insectRecords: true,
            receivedReviews: true,
            createdBloodlineCards: true,
          },
        },
      },
    }),
    // 프로필 "보유 혈통" 목록과 같은 기준(지금 보유한 ACTIVE 카드, 비공개 출처 카드는 본인에게만,
    // 뿌리가 숨김·회수된 출처 카드 제외). 뿌리 상태는 Prisma 관계 필터로 걸 수 없어 따로 센다.
    countProfileBloodlineCards(userId, myId),
  ]);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "유저를 찾을 수 없습니다.",
    });
  }

  // 현재 로그인한 유저가 해당 유저를 팔로우·차단하고 있는지 확인
  let isFollowing = false;
  let isBlocked = false;
  if (myId && myId !== userId) {
    const [follow, block] = await Promise.all([
      client.follow.findFirst({
        where: {
          followerId: myId,
          followingId: userId,
        },
      }),
      client.userBlock.findFirst({
        where: { blockerId: myId, blockedId: userId },
        select: { id: true },
      }),
    ]);
    isFollowing = !!follow;
    isBlocked = !!block;
  }

  // schema.prisma 의 User.followers 는 @relation("follower")(= 이 유저가 followerId 인 Follow,
  // 즉 이 유저가 팔로우하는 사람)라 Prisma _count 의 이름과 의미가 반대다.
  // 응답에서는 followers = 이 유저를 팔로우하는 수, following = 이 유저가 팔로우하는 수로 바로잡는다(#139).
  const userWithCounts = {
    ...user,
    _count: {
      ...user._count,
      followers: user._count.following,
      following: user._count.followers,
      ownedBloodlineCards,
    },
  };

  // 다른 사람에게는 로그인 식별자(snsId)·연락처(phone)·이메일 원문을 내려주지 않는다.
  const { snsId: _snsId, phone: _phone, ...publicUser } = userWithCounts;
  const safeUser: UserWithCounts =
    myId === userId
      ? { ...userWithCounts, maskedEmail: maskEmail(user.email) }
      : { ...publicUser, email: null, maskedEmail: maskEmail(user.email) };

  const [badges, breederPrograms] = await Promise.all([
    client.userBadge.findMany({
      where: { userId },
      select: {
        id: true,
        badgeType: true,
        rank: true,
        label: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { rank: "asc" }],
      take: 3,
    }),
    getActiveBreederProgramsByUserId(userId),
  ]);

  return res.json({
    success: true,
    user: {
      ...safeUser,
      badges: badges.map((badge) => ({
        ...badge,
        createdAt: badge.createdAt.toISOString(),
      })),
      breederPrograms: getSortedActiveBreederProgramSummaries(breederPrograms),
    },
    isFollowing,
    isBlocked,
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
