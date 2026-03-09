import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";

export interface BloodlineFollowResponse {
  success: boolean;
  isFollowing: boolean;
  followCount: number;
  bloodlineRootId: number | null;
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineFollowResponse>
) {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        isFollowing: false,
        followCount: 0,
        bloodlineRootId: null,
        error: "로그인이 필요합니다.",
      });
    }

    const parsedId = Number(req.query.id);
    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        isFollowing: false,
        followCount: 0,
        bloodlineRootId: null,
        error: "유효한 혈통카드 ID가 필요합니다.",
      });
    }

    const card = await client.bloodlineCard.findUnique({
      where: { id: parsedId },
      select: {
        id: true,
        status: true,
        cardType: true,
        bloodlineReferenceId: true,
      },
    });

    if (!card || card.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        isFollowing: false,
        followCount: 0,
        bloodlineRootId: null,
        error: "활성 혈통카드를 찾을 수 없습니다.",
      });
    }

    const bloodlineRootId =
      card.cardType === "BLOODLINE" ? card.id : card.bloodlineReferenceId;

    if (!bloodlineRootId) {
      return res.status(400).json({
        success: false,
        isFollowing: false,
        followCount: 0,
        bloodlineRootId: null,
        error: "원본 혈통 정보가 없습니다.",
      });
    }

    const existing = await client.bloodlineFollow.findUnique({
      where: {
        userId_bloodlineRootId: {
          userId,
          bloodlineRootId,
        },
      },
    });

    let isFollowing = false;
    if (req.method === "GET") {
      isFollowing = Boolean(existing);
    } else if (existing) {
      await client.bloodlineFollow.delete({
        where: {
          userId_bloodlineRootId: {
            userId,
            bloodlineRootId,
          },
        },
      });
      isFollowing = false;
    } else {
      await client.bloodlineFollow.create({
        data: {
          userId,
          bloodlineRootId,
        },
      });
      isFollowing = true;
    }

    const followCount = await client.bloodlineFollow.count({
      where: { bloodlineRootId },
    });

    return res.json({
      success: true,
      isFollowing,
      followCount,
      bloodlineRootId,
    });
  } catch (error) {
    console.error("[bloodline-cards][follow]", error);
    return res.status(500).json({
      success: false,
      isFollowing: false,
      followCount: 0,
      bloodlineRootId: null,
      error: "혈통 팔로우 처리에 실패했습니다.",
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
