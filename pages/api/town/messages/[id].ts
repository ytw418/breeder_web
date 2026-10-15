import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { deleteTownMessage, TownError } from "@libs/server/townTalk";

/** DELETE /api/town/messages/:id — 내 메시지 지우기('삭제한 메시지예요'로 남긴다). 운영자는 남의 것도. */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const id = Number(req.query.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "메시지를 찾을 수 없어요" });
  }
  try {
    await deleteTownMessage(req.user!.id, id, isModeratorUser(req.user));
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof TownError) {
      return res.status(error.status).json({ success: false, error: error.message, errorCode: error.errorCode });
    }
    throw error;
  }
}

export default withAuth(withHandler({ methods: ["DELETE"], handler, isPrivate: true }));
