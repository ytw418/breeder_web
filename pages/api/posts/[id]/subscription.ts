import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractPostIdFromPath } from "@libs/post-route";
import { isModeratorUser } from "@libs/server/adminAccess";

export interface PostSubscriptionResponse {
  success: true;
  subscription: { muted: boolean };
}

/**
 * PATCH /api/posts/:id/subscription { muted: boolean } — 이 글 새 댓글 알림 끄기·받기(상세 ⋯ 메뉴).
 * 댓글을 달면 자동으로 구독(muted=false)되고, 여기서 끄면 muted=true 로 남아 다시 댓글을 달아도 켜지지 않는다.
 * 구독이 없으면 만든다(글쓴이가 끄거나, 댓글 없이 '알림 받기'를 누를 때). 멱등.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType | PostSubscriptionResponse>) {
  const postId = extractPostIdFromPath(req.query.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }
  const muted = (req.body ?? {}).muted;
  if (typeof muted !== "boolean") {
    return res.status(400).json({ success: false, error: "muted 값이 필요합니다.", errorCode: "INVALID_MUTED" });
  }
  const user = req.user!;
  const post = await client.post.findUnique({ where: { id: postId }, select: { userId: true, isHidden: true } });
  // 숨긴 글은 작성자·관리자에게만 보인다(다른 사람에겐 없는 글과 같다).
  if (!post || (post.isHidden && post.userId !== user.id && !isModeratorUser(user))) {
    return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
  }
  const subscription = await client.postSubscription.upsert({
    where: { userId_postId: { userId: user.id, postId } },
    create: { userId: user.id, postId, muted },
    update: { muted },
    select: { muted: true },
  });
  return res.json({ success: true, subscription });
}

export default withAuth(
  withHandler({
    methods: ["PATCH"],
    handler,
    isPrivate: true,
  })
);
