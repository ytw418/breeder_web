import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { parsePositiveIntId } from "@libs/shared/normalize";
import {
  POST_NOT_PINNABLE_MESSAGE,
  PROFILE_PIN_LIMIT_MESSAGE,
  PROFILE_PIN_MAX,
} from "@libs/shared/profile";

export interface ProfilePinResponse {
  success: true;
  pinned: boolean;
  profilePinnedAt: string | null;
}

/**
 * POST /api/posts/:id/profile-pin { pinned: boolean } — 내 사진 글을 프로필 사진 그리드 맨 앞에 고정/해제.
 * 멱등: 이미 그 상태면 그대로 200. 한 사람당 최대 3개(넘으면 409 PROFILE_PIN_LIMIT).
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | ProfilePinResponse>
) {
  const postId = parsePositiveIntId(req.query.id);
  if (!postId) {
    return res.status(404).json({ success: false, message: "게시글을 찾을 수 없습니다." });
  }
  const pinned = (req.body ?? {}).pinned;
  if (typeof pinned !== "boolean") {
    return res.status(400).json({
      success: false,
      error: "pinned 값이 필요합니다.",
      errorCode: "INVALID_PINNED",
    });
  }

  const userId = req.user!.id;
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, image: true, images: true, category: true, profilePinnedAt: true },
  });
  if (!post) {
    return res.status(404).json({ success: false, message: "게시글을 찾을 수 없습니다." });
  }
  if (post.userId !== userId) {
    return res.status(403).json({
      success: false,
      error: POST_NOT_PINNABLE_MESSAGE,
      errorCode: "NOT_POST_OWNER",
    });
  }

  if (!pinned) {
    if (post.profilePinnedAt) {
      await client.post.update({ where: { id: postId }, data: { profilePinnedAt: null } });
    }
    return res.json({ success: true, pinned: false, profilePinnedAt: null });
  }

  const hasPhoto = (post.images?.length ?? 0) > 0 || !!post.image;
  if (!hasPhoto || post.category === "공지") {
    return res.status(400).json({
      success: false,
      error: POST_NOT_PINNABLE_MESSAGE,
      errorCode: "POST_NOT_PINNABLE",
    });
  }
  if (post.profilePinnedAt) {
    return res.json({
      success: true,
      pinned: true,
      profilePinnedAt: post.profilePinnedAt.toISOString(),
    });
  }

  // 작성자 행을 잠근 뒤 세고 저장한다. 같은 사람이 동시에 여러 글을 고정해도 4개가 되지 않는다.
  // 한도를 넘으면 null 을 돌려준다(트랜잭션은 그대로 끝난다).
  const updated = await client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const count = await tx.post.count({
      where: { userId, profilePinnedAt: { not: null } },
    });
    if (count >= PROFILE_PIN_MAX) return null;
    return tx.post.update({
      where: { id: postId },
      data: { profilePinnedAt: new Date() },
      select: { profilePinnedAt: true },
    });
  });
  if (!updated) {
    return res.status(409).json({
      success: false,
      error: PROFILE_PIN_LIMIT_MESSAGE,
      errorCode: "PROFILE_PIN_LIMIT",
    });
  }
  return res.json({
    success: true,
    pinned: true,
    profilePinnedAt: updated.profilePinnedAt?.toISOString() ?? null,
  });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
