import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { canEditAnyContent } from "@libs/server/adminAccess";
import { extractAuctionIdFromPath } from "@libs/auction-route";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
import { restartAuction } from "@libs/server/auctionRestart";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";

/** 경매 다시 시작 응답 타입 */
export interface RestartAuctionResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  auction?: { id: number; status: "진행중"; round: number; endAt: string; currentPrice: number };
  restartsLeft?: number;
}

/**
 * POST /api/auctions/:id/restart  body { endAt: ISO, reason?: "NO_CONTACT" | "DECLINED" | "OTHER" }
 * 유찰된 경매, 또는 낙찰자가 입양하지 않은 경매(사유 필수)를 기간만 새로 정해 다시 연다. 앱 docs/prd/auction-restart.md
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const { user } = req;
  if (!user?.id) {
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      errorCode: "AUCTION_AUTH_REQUIRED",
    });
  }

  const auctionId = extractAuctionIdFromPath(req.query.id);
  if (Number.isNaN(auctionId)) {
    return res.status(400).json({
      success: false,
      error: "유효하지 않은 경매 ID입니다.",
      errorCode: "AUCTION_INVALID_ID",
    });
  }

  const result = await restartAuction({
    auctionId,
    actorId: user.id,
    actorCanManageAny: canEditAnyContent(user),
    endAt: req.body?.endAt,
    reason: req.body?.reason,
  });
  if (!result.ok) {
    return res.status(result.status).json({
      success: false,
      error: result.error,
      errorCode: result.errorCode,
    });
  }

  await captureServerEvent(user.id, "auction_restarted", {
    auction_id: auctionId,
    round: result.auction.round,
    from_status: result.fromStatus,
    reason: result.reason,
    platform: resolveClientPlatform(req),
  });

  return res.json({
    success: true,
    auction: result.auction,
    restartsLeft: result.restartsLeft,
  });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler: withDetailRevalidation(handler, (req) => [
      { type: "AUCTION", id: extractAuctionIdFromPath(req.query.id) },
    ]),
    isPrivate: true,
  })
);
