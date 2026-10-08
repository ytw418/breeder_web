import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { areOwnedPhotoPosts, getAlbumPosts } from "@libs/server/profileAlbums";
import { parsePositiveIntId } from "@libs/shared/normalize";
import {
  ALBUM_NOT_FOUND_MESSAGE,
  ALBUM_POSTS_INVALID_MESSAGE,
  ALBUM_TITLE_INVALID_MESSAGE,
  NOT_ALBUM_OWNER_MESSAGE,
  normalizeAlbumPostIds,
  normalizeAlbumTitle,
} from "@libs/shared/profile";

/**
 * /api/albums/:id (앱 docs/prd/profile.md AC-24, AC-25)
 * - GET: 앨범 + 넣은 순서대로 보이는 사진 글(공개, 숨김 글은 주인·운영자만)
 * - POST { title?, postIds? }: 주인만 수정
 * - DELETE: 주인만 삭제
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const albumId = parsePositiveIntId(req.query.id);
  const album = albumId
    ? await client.profileAlbum.findUnique({
        where: { id: albumId },
        select: {
          id: true,
          title: true,
          userId: true,
          postIds: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      })
    : null;
  if (!album) {
    return res.status(404).json({ success: false, error: ALBUM_NOT_FOUND_MESSAGE, errorCode: "ALBUM_NOT_FOUND" });
  }
  const viewer = req.user;

  if (req.method === "GET") {
    const canSeeHidden = viewer?.id === album.userId || isModeratorUser(viewer);
    const posts = await getAlbumPosts(album.userId, album.postIds, canSeeHidden);
    const { postIds: _postIds, ...rest } = album;
    return res.json({ success: true, album: rest, posts });
  }

  // 쓰기는 로그인한 주인만(GET 이 공개라 withHandler.isPrivate 대신 여기서 확인한다).
  if (!viewer) {
    return res.status(401).json({ success: false, message: "로그인이 필요한 요청입니다!" });
  }
  if (viewer.id !== album.userId) {
    return res.status(403).json({ success: false, error: NOT_ALBUM_OWNER_MESSAGE, errorCode: "NOT_ALBUM_OWNER" });
  }

  if (req.method === "DELETE") {
    await client.profileAlbum.delete({ where: { id: album.id } });
    return res.json({ success: true });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const data: { title?: string; postIds?: number[] } = {};
  if ("title" in body) {
    const title = normalizeAlbumTitle(body.title);
    if (!title) {
      return res.status(400).json({ success: false, error: ALBUM_TITLE_INVALID_MESSAGE, errorCode: "ALBUM_TITLE_INVALID" });
    }
    data.title = title;
  }
  if ("postIds" in body) {
    const postIds = normalizeAlbumPostIds(body.postIds);
    if (!postIds || !(await areOwnedPhotoPosts(client, album.userId, postIds))) {
      return res.status(400).json({ success: false, error: ALBUM_POSTS_INVALID_MESSAGE, errorCode: "ALBUM_POSTS_INVALID" });
    }
    data.postIds = postIds;
  }
  const updated = await client.profileAlbum.update({
    where: { id: album.id },
    data,
    select: { id: true, title: true, postIds: true, createdAt: true },
  });
  return res.json({ success: true, album: updated });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST", "DELETE"],
    handler,
    isPrivate: false,
  })
);
