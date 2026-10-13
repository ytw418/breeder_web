import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { AUCTION_MAX_ACTIVE_PER_USER, isAuctionDurationValid } from "@libs/auctionRules";
import {
  AUCTION_NO_SHOW_REPORT_REASON,
  AUCTION_RESTART_ERROR_MESSAGES,
  AUCTION_RESTART_NOTIFICATIONS,
  auctionNoShowReportDetail,
  getAuctionRestartState,
  isAuctionRestartReasonId,
  type AuctionRestartReasonId,
} from "@libs/shared/auctionRestart";

/**
 * 경매 다시 시작(앱 docs/prd/auction-restart.md). 같은 경매 행을 다음 회차로 연다.
 * - 상태 진행중, 낙찰자 없음, 현재가 = 시작가, 새 마감 시각, round + 1, 목록 맨 위(listedAt = now).
 * - 지난 회차 입찰은 archivedAt 을 찍어 현재 회차 입찰·최고가·낙찰에서 뺀다(기록은 남긴다).
 * - 낙찰자가 있던 종료 경매면 사유가 필요하고, 그 낙찰자는 이 경매에 다시 입찰할 수 없으며(AuctionRestart.previousWinnerId),
 *   운영팀에 '낙찰 후 노쇼' 신고를 자동으로 접수한다. 제재는 운영자가 판단한다.
 */

const MESSAGES: Record<string, string> = {
  ...AUCTION_RESTART_ERROR_MESSAGES,
  AUCTION_NOT_FOUND: "경매를 찾을 수 없습니다.",
  AUCTION_INVALID_END_AT: "유효한 종료 시간을 선택해주세요.",
  AUCTION_ACTIVE_LIMIT_EXCEEDED: "동시 진행 경매는 최대 100개까지 등록할 수 있습니다.",
};

export type RestartAuctionResult =
  | {
      ok: true;
      auction: { id: number; status: "진행중"; round: number; endAt: string; currentPrice: number };
      restartsLeft: number;
      fromStatus: string;
      reason: AuctionRestartReasonId | null;
    }
  | { ok: false; status: number; errorCode: string; error: string };

/** 트랜잭션 안에서 회차·상태가 바뀐 걸 알리는 값(ES5 대상에선 Error 하위 클래스 instanceof 가 깨진다). */
const RESTART_CONFLICT = Symbol("auction-restart-conflict");

const fail = (status: number, errorCode: string): RestartAuctionResult => ({
  ok: false,
  status,
  errorCode,
  error: MESSAGES[errorCode] ?? "요청 처리 중 오류가 발생했습니다.",
});

export async function restartAuction(input: {
  auctionId: number;
  actorId: number;
  /** 운영자 이메일(canEditAnyContent)이면 남의 경매도 다시 시작할 수 있다. */
  actorCanManageAny: boolean;
  endAt: unknown;
  reason: unknown;
}): Promise<RestartAuctionResult> {
  const { auctionId, actorId } = input;

  // 마감 시각이 지난 진행중 경매면 먼저 유찰·종료로 정산한다.
  await settleExpiredAuctions(auctionId);

  const actor = await client.user.findUnique({
    where: { id: actorId },
    select: { status: true },
  });
  if (!actor || actor.status !== "ACTIVE") return fail(403, "AUCTION_RESTART_ACCOUNT_RESTRICTED");

  const auction = await client.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      title: true,
      userId: true,
      status: true,
      winnerId: true,
      round: true,
      isHidden: true,
      startPrice: true,
      currentPrice: true,
      endAt: true,
      user: { select: { name: true } },
    },
  });
  if (!auction) return fail(404, "AUCTION_NOT_FOUND");
  if (auction.userId !== actorId && !input.actorCanManageAny) {
    return fail(403, "AUCTION_RESTART_FORBIDDEN");
  }

  const state = getAuctionRestartState(auction);
  if (state.lock === "limit") return fail(400, "AUCTION_RESTART_LIMIT_EXCEEDED");
  if (!state.eligible) return fail(400, "AUCTION_RESTART_NOT_ALLOWED");

  const reason = state.reasonRequired && isAuctionRestartReasonId(input.reason) ? input.reason : null;
  if (state.reasonRequired && !reason) return fail(400, "AUCTION_RESTART_REASON_REQUIRED");

  const endDate = new Date(String(input.endAt ?? ""));
  if (!input.endAt || Number.isNaN(endDate.getTime())) return fail(400, "AUCTION_INVALID_END_AT");
  const now = new Date();
  if (!isAuctionDurationValid(endDate, now)) return fail(400, "AUCTION_DURATION_OUT_OF_RANGE_RESTART");

  const activeCount = await client.auction.count({
    where: { userId: auction.userId, status: "진행중" },
  });
  if (activeCount >= AUCTION_MAX_ACTIVE_PER_USER) return fail(400, "AUCTION_ACTIVE_LIMIT_EXCEEDED");

  // 이번 회차 입찰자(알림 대상)와 입찰 수(지난 경매 요약).
  const roundBids = await client.bid.findMany({
    where: { auctionId, archivedAt: null },
    select: { userId: true },
  });
  const blockedWinnerId = reason ? auction.winnerId : null;

  // 탈퇴로 행이 없는 낙찰자는 신고할 대상이 없다(입찰 막기는 그대로 남긴다).
  let reportTargetId: number | null = null;
  let existingReportId: number | null = null;
  if (blockedWinnerId) {
    const winner = await client.user.findUnique({
      where: { id: blockedWinnerId },
      select: { id: true },
    });
    if (winner) {
      reportTargetId = winner.id;
      const openReport = await client.auctionReport.findFirst({
        where: {
          auctionId,
          reportedUserId: winner.id,
          reason: AUCTION_NO_SHOW_REPORT_REASON,
          status: "OPEN",
        },
        select: { id: true },
      });
      existingReportId = openReport?.id ?? null;
    }
  }

  const nextRound = auction.round + 1;
  try {
    await client.$transaction(async (tx) => {
      // 같은 회차·같은 상태일 때만 연다(동시에 두 번 누르거나 운영자가 상태를 바꾼 경우 409).
      const opened = await tx.auction.updateMany({
        where: { id: auctionId, round: auction.round, status: auction.status, isHidden: false },
        data: {
          status: "진행중",
          winnerId: null,
          currentPrice: auction.startPrice,
          endAt: endDate,
          round: nextRound,
          listedAt: now,
        },
      });
      if (!opened.count) throw RESTART_CONFLICT;

      await tx.bid.updateMany({
        where: { auctionId, archivedAt: null },
        data: { archivedAt: now },
      });

      let reportId = existingReportId;
      if (reason && reportTargetId && !reportId) {
        const report = await tx.auctionReport.create({
          data: {
            auctionId,
            reporterId: auction.userId,
            reportedUserId: reportTargetId,
            reason: AUCTION_NO_SHOW_REPORT_REASON,
            detail: auctionNoShowReportDetail({
              round: auction.round,
              price: auction.currentPrice,
              reason,
            }),
          },
          select: { id: true },
        });
        reportId = report.id;
      }

      await tx.auctionRestart.create({
        data: {
          auctionId,
          round: auction.round,
          previousStatus: auction.status,
          previousEndAt: auction.endAt,
          previousPrice: auction.currentPrice,
          previousBidCount: roundBids.length,
          previousWinnerId: blockedWinnerId,
          reason,
          reportId,
          restartedBy: actorId,
          newEndAt: endDate,
        },
      });
    });
  } catch (error) {
    if (error === RESTART_CONFLICT) return fail(409, "AUCTION_RESTART_CONFLICT");
    console.error("[auctionRestart]", error);
    return fail(500, "AUCTION_RESTART_FAILED");
  }

  // 알림: 낙찰이 취소된 낙찰자, 그리고 지난 회차의 다른 입찰자(다시 입찰할 가능성이 가장 높다).
  const sellerName = auction.user?.name || "분양자";
  const notifyTasks: Promise<unknown>[] = [];
  if (blockedWinnerId) {
    notifyTasks.push(
      createNotification({
        type: "AUCTION_RESTARTED",
        userId: blockedWinnerId,
        senderId: auction.userId,
        message: AUCTION_RESTART_NOTIFICATIONS.winnerCancelled(sellerName, auction.title),
        targetId: auctionId,
        targetType: "auction",
      })
    );
  }
  const bidderIds = Array.from(new Set(roundBids.map((bid) => bid.userId))).filter(
    (bidderId) => bidderId !== blockedWinnerId && bidderId !== auction.userId
  );
  for (const bidderId of bidderIds) {
    notifyTasks.push(
      createNotification({
        type: "AUCTION_RESTARTED",
        userId: bidderId,
        senderId: auction.userId,
        message: AUCTION_RESTART_NOTIFICATIONS.bidderInvite(sellerName, auction.title, auction.startPrice),
        targetId: auctionId,
        targetType: "auction",
      })
    );
  }
  await Promise.all(notifyTasks);

  return {
    ok: true,
    auction: {
      id: auctionId,
      status: "진행중",
      round: nextRound,
      endAt: endDate.toISOString(),
      currentPrice: auction.startPrice,
    },
    restartsLeft: Math.max(0, state.restartsLeft - 1),
    fromStatus: auction.status,
    reason,
  };
}
