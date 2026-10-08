import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { areOwnedPhotoPosts } from "@libs/server/profileAlbums";
import {
  ALBUM_LIMIT_MESSAGE,
  ALBUM_MAX,
  ALBUM_POSTS_INVALID_MESSAGE,
  ALBUM_TITLE_INVALID_MESSAGE,
  normalizeAlbumPostIds,
  normalizeAlbumTitle,
} from "@libs/shared/profile";

/**
 * POST /api/albums { title, postIds } — 내 사진 글로 앨범 만들기(앱 docs/prd/profile.md AC-22).
 * 한 사람당 10개(작성자 행을 잠근 뒤 센다), 앨범당 30장, 이름 1~12자.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user!.id;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = normalizeAlbumTitle(body.title);
  if (!title) {
    return res.status(400).json({ success: false, error: ALBUM_TITLE_INVALID_MESSAGE, errorCode: "ALBUM_TITLE_INVALID" });
  }
  const postIds = normalizeAlbumPostIds(body.postIds);
  if (!postIds) {
    return res.status(400).json({ success: false, error: ALBUM_POSTS_INVALID_MESSAGE, errorCode: "ALBUM_POSTS_INVALID" });
  }

  const result = await client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (!(await areOwnedPhotoPosts(tx, userId, postIds))) return "invalid" as const;
    const count = await tx.profileAlbum.count({ where: { userId } });
    if (count >= ALBUM_MAX) return "limit" as const;
    return tx.profileAlbum.create({
      data: { userId, title, postIds },
      select: { id: true, title: true, postIds: true, createdAt: true },
    });
  });

  if (result === "invalid") {
    return res.status(400).json({ success: false, error: ALBUM_POSTS_INVALID_MESSAGE, errorCode: "ALBUM_POSTS_INVALID" });
  }
  if (result === "limit") {
    return res.status(409).json({ success: false, error: ALBUM_LIMIT_MESSAGE, errorCode: "ALBUM_LIMIT" });
  }
  return res.json({ success: true, album: result });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
