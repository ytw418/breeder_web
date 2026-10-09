import type { role } from "@prisma/client";
import { isModeratorUser } from "@libs/server/adminAccess";

/**
 * 경매 판매자가 적은 연락처(전화·이메일)는 판매자 본인·낙찰자·운영자에게만 그대로 보인다.
 * 그 밖의 사람(비로그인 포함)에게는 "010-****-4924", "rk****@naver.com" 처럼 가린 값만 내려준다.
 * 목록 API 는 연락처를 아예 싣지 않는다. 카페·밴드 닉네임, 블로그, 신뢰 메모는 공개용이라 그대로 둔다.
 */

type ContactViewer = { id?: number; role?: role | null; email?: string | null } | null | undefined;

type AuctionContactOwner = {
  userId: number;
  winnerId: number | null;
  status: string;
};

export function maskPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // +82 10-1234-5678 → 01012345678
  if (raw.trim().startsWith("+82") && digits.startsWith("82")) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length < 8) return "***";
  const head = digits.startsWith("02") ? "02" : digits.slice(0, 3);
  return `${head}-****-${digits.slice(-4)}`;
}

export function maskEmail(raw: string): string {
  const at = raw.lastIndexOf("@");
  if (at <= 0 || at === raw.length - 1) return "***";
  const local = raw.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}****${raw.slice(at)}`;
}

export function canViewAuctionContact(
  auction: AuctionContactOwner,
  viewer: ContactViewer
): boolean {
  if (!viewer?.id) return false;
  if (viewer.id === auction.userId) return true;
  if (isModeratorUser(viewer)) return true;
  return auction.status === "종료" && auction.winnerId === viewer.id;
}

export function toViewerAuctionContact(
  auction: AuctionContactOwner & {
    sellerPhone: string | null;
    sellerEmail: string | null;
  },
  viewer: ContactViewer
) {
  const hasContact = Boolean(auction.sellerPhone || auction.sellerEmail);
  if (!hasContact || canViewAuctionContact(auction, viewer)) {
    return {
      sellerPhone: auction.sellerPhone,
      sellerEmail: auction.sellerEmail,
      sellerContactMasked: false,
    };
  }
  return {
    sellerPhone: auction.sellerPhone ? maskPhone(auction.sellerPhone) : null,
    sellerEmail: auction.sellerEmail ? maskEmail(auction.sellerEmail) : null,
    sellerContactMasked: true,
  };
}

/**
 * 수정 화면이 가린 값을 받아 그대로 다시 보내면(로그인이 풀린 채 열었다가 다시 로그인한 경우 등)
 * 저장된 원래 연락처를 지킨다. 새로 적은 값이면 그 값을 쓴다.
 */
export function keepStoredContactWhenMasked<T extends string | null | undefined>(
  incoming: T,
  stored: string | null | undefined,
  mask: (value: string) => string
): T | string {
  if (typeof incoming !== "string" || !stored) return incoming;
  return incoming.trim() === mask(stored) ? stored : incoming;
}
