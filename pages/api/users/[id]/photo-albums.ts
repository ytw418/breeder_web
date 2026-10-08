import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { getSpeciesAlbums, type SpeciesAlbum } from "@libs/server/profileSpecies";
import { parsePositiveIntId } from "@libs/shared/normalize";

export interface PhotoAlbumsResponse {
  success: true;
  albums: SpeciesAlbum[];
}

/**
 * GET /api/users/:id/photo-albums — 프로필 앨범 줄(종별 자동 앨범).
 * 사진 글이 많은 종부터 최대 8개. 공지·사진 없는 글·종 없는 글은 빼고, 숨김 글은 작성자·운영자만 센다.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | PhotoAlbumsResponse>
) {
  const userId = parsePositiveIntId(req.query.id);
  if (!userId) {
    return res.status(404).json({ success: false, message: "유저를 찾을 수 없습니다." });
  }
  const viewer = req.user;
  const canSeeHidden = viewer?.id === userId || isModeratorUser(viewer);
  const albums = await getSpeciesAlbums(userId, canSeeHidden);
  return res.json({ success: true, albums });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
