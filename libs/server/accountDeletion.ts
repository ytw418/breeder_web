import crypto from "crypto";
import type { Prisma } from "@prisma/client";

import client from "@libs/server/client";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { AUCTION_SETTLEMENT_GRACE_DAYS } from "@libs/auctionRules";
import {
  DELETED_USER_PREFIX,
  buildDeletedUserName,
  isDeletedUserName,
} from "@libs/shared/deletedUser";

/**
 * 회원탈퇴(소프트 삭제).
 * - 작성한 게시글·댓글·상품·채팅·경매 기록은 남기고 User 를 "탈퇴한 사용자#<id>" 로 익명화한다.
 * - 개인정보 원문은 UserDeletionRecord 에 30일 보관(오탈퇴 CS·거래 분쟁 대응) 후 파기한다.
 * - 진행 중인 경매·거래가 있으면 탈퇴를 막는다.
 */

export { DELETED_USER_PREFIX, buildDeletedUserName, isDeletedUserName };

export const ACCOUNT_DELETION_RETENTION_DAYS = 30;
/** 탈퇴 처리된 User.snsId 접두사. 원문 대신 해시를 둔다. */
const ANONYMIZED_SNS_ID_PREFIX = "deleted:";
const DAY_MS = 24 * 60 * 60 * 1000;

type Db = typeof client | Prisma.TransactionClient;

export type DeletionBlockerCode =
  | "AUCTION_SELLING_ACTIVE"
  | "AUCTION_TOP_BIDDER"
  | "AUCTION_SETTLING_SELLER"
  | "AUCTION_SETTLING_WINNER"
  | "PRODUCT_RESERVED";

export interface DeletionBlocker {
  code: DeletionBlockerCode;
  message: string;
  items: { id: number; title: string; endAt?: string }[];
}

const BLOCKER_MESSAGES: Record<DeletionBlockerCode, string> = {
  AUCTION_SELLING_ACTIVE: "진행 중인 판매 경매가 있어요.",
  AUCTION_TOP_BIDDER: "최고 입찰 중인 경매가 있어요.",
  AUCTION_SETTLING_SELLER: `낙찰된 지 ${AUCTION_SETTLEMENT_GRACE_DAYS}일이 지나지 않은 판매 경매가 있어요.`,
  AUCTION_SETTLING_WINNER: `낙찰받은 지 ${AUCTION_SETTLEMENT_GRACE_DAYS}일이 지나지 않은 경매가 있어요.`,
  PRODUCT_RESERVED: "예약중인 상품이 있어요.",
};

/** 탈퇴 이력 확인용 해시. 서버 시크릿을 섞어 원문을 역추적할 수 없게 한다. */
export function hashSnsId(snsId: string) {
  const secret =
    process.env.ACCOUNT_HASH_SECRET || process.env.COOKIE_PASSWORD || "";
  return crypto.createHmac("sha256", secret).update(snsId).digest("hex");
}

type AuctionRow = { id: number; title: string; endAt: Date };

const toAuctionItems = (rows: AuctionRow[]) =>
  rows.map((row) => ({
    id: row.id,
    title: row.title,
    endAt: row.endAt.toISOString(),
  }));

async function queryDeletionBlockers(
  db: Db,
  userId: number,
  now: Date
): Promise<DeletionBlocker[]> {
  const settledSince = new Date(
    now.getTime() - AUCTION_SETTLEMENT_GRACE_DAYS * DAY_MS
  );
  const auctionSelect = { id: true, title: true, endAt: true } as const;

  const [selling, bidding, soldRecently, wonRecently, reserved] =
    await Promise.all([
      db.auction.findMany({
        where: { userId, status: "진행중" },
        select: auctionSelect,
      }),
      db.auction.findMany({
        where: { status: "진행중", bids: { some: { userId } } },
        select: {
          ...auctionSelect,
          bids: {
            orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
            take: 1,
            select: { userId: true },
          },
        },
      }),
      db.auction.findMany({
        where: {
          userId,
          status: "종료",
          winnerId: { not: null },
          endAt: { gte: settledSince },
        },
        select: auctionSelect,
      }),
      db.auction.findMany({
        where: { winnerId: userId, status: "종료", endAt: { gte: settledSince } },
        select: auctionSelect,
      }),
      db.product.findMany({
        where: { userId, status: "예약중", isDeleted: false },
        select: { id: true, name: true },
      }),
    ]);

  const topBidding = bidding.filter((auction) => auction.bids[0]?.userId === userId);

  const blockers: DeletionBlocker[] = [];
  const push = (code: DeletionBlockerCode, items: DeletionBlocker["items"]) => {
    if (items.length) blockers.push({ code, message: BLOCKER_MESSAGES[code], items });
  };
  push("AUCTION_SELLING_ACTIVE", toAuctionItems(selling));
  push("AUCTION_TOP_BIDDER", toAuctionItems(topBidding));
  push("AUCTION_SETTLING_SELLER", toAuctionItems(soldRecently));
  push("AUCTION_SETTLING_WINNER", toAuctionItems(wonRecently));
  push(
    "PRODUCT_RESERVED",
    reserved.map((product) => ({ id: product.id, title: product.name }))
  );
  return blockers;
}

/** 탈퇴를 막는 진행 중 경매·거래 목록. 만료됐지만 정산 전인 경매를 먼저 정리한다. */
export async function findDeletionBlockers(userId: number, now = new Date()) {
  await settleExpiredAuctions();
  return queryDeletionBlockers(client, userId, now);
}

export type DeleteAccountResult =
  | { ok: true; deletedAt: Date; purgeAt: Date }
  | { ok: false; code: "ACCOUNT_DELETION_BLOCKED"; blockers: DeletionBlocker[] }
  | { ok: false; code: "ACCOUNT_ALREADY_DELETED" }
  | { ok: false; code: "USER_NOT_FOUND" };

export async function deleteAccount(
  userId: number,
  options: { reason?: string | null; now?: Date; force?: boolean } = {}
): Promise<DeleteAccountResult> {
  const now = options.now ?? new Date();
  const purgeAt = new Date(now.getTime() + ACCOUNT_DELETION_RETENTION_DAYS * DAY_MS);
  const reason = options.reason?.trim().slice(0, 500) || null;

  await settleExpiredAuctions();

  return client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, code: "USER_NOT_FOUND" } as const;
    // 예전 관리자 상태 변경은 status 만 DELETED 로 바꿔 개인정보가 남아 있다. snsId 가 해시로 바뀐 행만 탈퇴 완료로 본다.
    if (user.status === "DELETED" && user.snsId.startsWith(ANONYMIZED_SNS_ID_PREFIX)) {
      return { ok: false, code: "ACCOUNT_ALREADY_DELETED" } as const;
    }

    // 조회 화면 이후 새 입찰이 들어올 수 있어 실행 직전에 다시 판정한다.
    if (!options.force) {
      const blockers = await queryDeletionBlockers(tx, userId, now);
      if (blockers.length) {
        return { ok: false, code: "ACCOUNT_DELETION_BLOCKED", blockers } as const;
      }
    }

    const snsIdHash = hashSnsId(user.snsId);

    await tx.userDeletionRecord.create({
      data: {
        userId,
        provider: user.provider,
        snsId: user.snsId,
        snsIdHash,
        email: user.email,
        phone: user.phone,
        name: user.name,
        reason,
        requestedAt: now,
        purgeAt,
      },
    });

    // unique 컬럼(snsId/email/phone/name)은 즉시 비워 같은 이메일·전화의 다른 계정 가입을 막지 않는다.
    // tokenVersion 을 올려 모든 기기의 access/refresh 토큰을 즉시 무효화한다.
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        deletedAt: now,
        name: buildDeletedUserName(userId),
        email: null,
        phone: null,
        avatar: null,
        snsId: `${ANONYMIZED_SNS_ID_PREFIX}${snsIdHash}`,
        tokenVersion: { increment: 1 },
        suspendedUntil: null,
      },
    });

    // 콘텐츠가 아닌 개인 설정·수신함은 바로 지운다.
    await tx.fcmToken.deleteMany({ where: { userId } });
    await tx.fav.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    });
    await tx.alertSubscription.deleteMany({ where: { userId } });
    await tx.bloodlineFollow.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    // 보낸 알림 문구("<닉네임>님이 회원님을 팔로우했습니다." 등)에 박힌 원래 닉네임도 남기지 않는다.
    if (user.name) {
      await tx.notification.deleteMany({
        where: { senderId: userId, message: { contains: user.name } },
      });
    }

    // 판매중 상품은 기록은 두고 목록에서만 내린다.
    await tx.product.updateMany({
      where: { userId, status: "판매중", isDeleted: false },
      data: { isHidden: true },
    });

    return { ok: true, deletedAt: now, purgeAt } as const;
  });
}

/** 같은 소셜 계정으로 다시 로그인할 때, 아직 보관 기간이면 재가입을 막는다. */
export async function findPendingDeletion(snsId: string) {
  const record = await client.userDeletionRecord.findFirst({
    where: { snsId, purgedAt: null },
    select: { purgeAt: true },
  });
  return record ? { purgeAt: record.purgeAt } : null;
}

/** 보관 기한이 지난 탈퇴자의 개인정보 원문을 파기한다. cron 에서 호출. 멱등. */
export async function purgeDeletedAccounts(now = new Date(), limit = 100) {
  const records = await client.userDeletionRecord.findMany({
    where: { purgedAt: null, purgeAt: { lte: now } },
    orderBy: { purgeAt: "asc" },
    take: limit,
  });

  let purged = 0;
  let failed = 0;

  for (const record of records) {
    try {
      await client.$transaction(async (tx) => {
        await tx.auction.updateMany({
          where: { userId: record.userId },
          data: {
            sellerPhone: null,
            sellerEmail: null,
            sellerBlogUrl: null,
            sellerCafeNick: null,
            sellerBandNick: null,
            sellerProofImage: null,
            sellerTrustNote: null,
          },
        });
        await tx.guinnessSubmission.updateMany({
          where: { userId: record.userId },
          data: { contactPhone: null, contactEmail: null },
        });
        // contactEmail 은 필수 컬럼이라 비울 수 없어 무효 주소로 덮는다.
        await tx.voiceInquiry.updateMany({
          where: { requesterId: record.userId },
          data: { contactEmail: "deleted@invalid", requesterName: null },
        });
        await tx.userDeletionRecord.update({
          where: { id: record.id },
          data: {
            snsId: null,
            email: null,
            phone: null,
            name: null,
            reason: null,
            purgedAt: now,
          },
        });
      });
      purged += 1;
    } catch (error) {
      failed += 1;
      console.error("[account-deletion][purge]", record.id, error);
    }
  }

  return { purged, failed };
}
