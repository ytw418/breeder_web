import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractBearerToken } from "@libs/server/jwt";

/**
 * 경매 조회수를 1 올린다. 상세 화면이 열릴 때 한 번 호출한다(분양글 /api/products/:id/view 와 같은 규칙).
 * 목록 '지금 많이 보는 중' 딱지 기준이다(libs/shared/auctionBadge.ts, 2026-10-22 사용자 결정 — 지어낸 문구를 쓰지 않는다).
 * - 비로그인도 센다. 분양자 본인이 보는 것은 세지 않는다(200, counted:false).
 * - 숨긴 경매는 404 로 막고 세지 않는다.
 * - 토큰을 보냈는데 user 가 없으면(만료·무효) 401 로 돌려 세지 않는다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    query: { id = "" },
    user,
  } = req;

  // 만료 토큰을 비로그인으로 보고 세면 분양자 본인 조회가 섞인다.
  if (extractBearerToken(req.headers.authorization) && !user) {
    return res.status(401).json({ success: false, message: "인증이 만료되었습니다." });
  }

  const auctionId = Number(id.toString().split("-")[0]);
  if (!Number.isInteger(auctionId) || auctionId <= 0) {
    return res.status(400).json({ success: false, message: "유효하지 않은 경매 ID입니다." });
  }

  const auction = await client.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, userId: true, isHidden: true, viewCount: true },
  });

  if (!auction || auction.isHidden) {
    return res.status(404).json({
      success: false,
      message: "삭제되었거나 숨겨진 경매입니다.",
      errorCode: "AUCTION_HIDDEN",
    });
  }

  if (user?.id === auction.userId) {
    return res.json({ success: true, counted: false, viewCount: auction.viewCount });
  }

  const updated = await client.auction.update({
    where: { id: auctionId },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  return res.json({ success: true, counted: true, viewCount: updated.viewCount });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: false,
  })
);
