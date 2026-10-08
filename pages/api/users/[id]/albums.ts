import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { getAlbumSummaries, type AlbumSummary } from "@libs/server/profileAlbums";
import { parsePositiveIntId } from "@libs/shared/normalize";

export interface UserAlbumsResponse {
  success: true;
  albums: AlbumSummary[];
}

/**
 * GET /api/users/:id/albums — 사용자가 만든 앨범(최근 만든 순). 앨범마다 표지·사진 수.
 * 남이 볼 때는 숨김 글을 세지 않고 사진 0장 앨범을 뺀다(주인에게는 빈 앨범도 보인다).
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | UserAlbumsResponse>
) {
  const userId = parsePositiveIntId(req.query.id);
  if (!userId) {
    return res.status(404).json({ success: false, message: "유저를 찾을 수 없습니다." });
  }
  const viewer = req.user;
  const isOwner = viewer?.id === userId;
  const canSeeHidden = isOwner || isModeratorUser(viewer);
  const albums = await getAlbumSummaries(userId, canSeeHidden, isOwner);
  return res.json({ success: true, albums });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
