import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { extractAuctionIdFromPath } from "@libs/auction-route";

const REPORT_REASONS = [
  "허위 매물 의심",
  "입찰 방해/분쟁 유도",
  "비정상 가격 유도",
  "욕설/부적절 내용",
  "기타",
] as const;

interface AuctionReportResponse extends ResponseType {
  report?: {
    id: number;
    status: string;
    createdAt: string;
  };
  error?: string;
  errorCode?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuctionReportResponse>
) {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      errorCode: "REPORT_AUTH_REQUIRED",
    });
  }

  const auctionId = extractAuctionIdFromPath(req.query.id);
  if (Number.isNaN(auctionId)) {
    return res.status(400).json({
      success: false,
      error: "유효하지 않은 경매 ID입니다.",
      errorCode: "REPORT_INVALID_AUCTION_ID",
    });
  }

  const reason = String(req.body?.reason || "").trim();
  const detail = String(req.body?.detail || "").trim();

  if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) {
    return res.status(400).json({
      success: false,
      error: "신고 사유를 선택해주세요.",
      errorCode: "REPORT_INVALID_REASON",
    });
  }

  if (detail.length < 5 || detail.length > 500) {
    return res.status(400).json({
      success: false,
      error: "신고 내용은 5자 이상 500자 이하로 입력해주세요.",
      errorCode: "REPORT_INVALID_DETAIL_LENGTH",
    });
  }

  const reporter = await client.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!reporter || reporter.status !== "ACTIVE") {
    return res.status(403).json({
      success: false,
      error: "현재 계정 상태에서는 신고할 수 없습니다.",
      errorCode: "REPORT_ACCOUNT_RESTRICTED",
    });
  }

  const auction = await client.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, userId: true },
  });
  if (!auction) {
    return res.status(404).json({
      success: false,
      error: "경매를 찾을 수 없습니다.",
      errorCode: "REPORT_AUCTION_NOT_FOUND",
    });
  }

  if (auction.userId === userId) {
    return res.status(400).json({
      success: false,
      error: "본인 경매는 신고할 수 없습니다.",
      errorCode: "REPORT_SELF_NOT_ALLOWED",
    });
  }

  const hasOpenReport = Boolean(
    await client.auctionReport.findFirst({
      where: {
        auctionId,
        reporterId: userId,
        status: "OPEN",
      },
      select: { id: true },
    })
  );

  if (hasOpenReport) {
    return res.status(400).json({
      success: false,
      error: "이미 접수된 신고가 있습니다. 운영자 검토를 기다려주세요.",
      errorCode: "REPORT_ALREADY_EXISTS",
    });
  }

  const report = await client.auctionReport.create({
    data: {
      auctionId,
      reporterId: userId,
      reportedUserId: auction.userId,
      reason,
      detail,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  return res.json({
    success: true,
    report: {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    },
  });
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
