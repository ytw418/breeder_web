"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";

import Image from "@components/atoms/Image";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import Layout from "@components/features/MainLayout";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { ImageCarousel } from "@components/app/ImageCarousel";
import { PriceInput } from "@components/app/PriceInput";
import { QueryErrorState } from "@components/app/QueryErrorState";
import {
  BreederProgramBadge,
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import useAdminModeration from "hooks/useAdminModeration";
import { ActionSheet } from "@components/app/ActionSheet";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import HiddenContentNotice from "@components/app/moderation/HiddenContentNotice";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { absoluteUrl, copyText, shareOrCopy } from "@libs/client/share";
import { getAuctionResultMessage } from "@libs/client/auctionErrorMessage";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { extractAuctionIdFromPath, toAuctionPath } from "@libs/auction-route";
import { DELETED_USER_LABEL, isDeletedUserName } from "@libs/shared/deletedUser";
import {
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  isBidAmountValid,
  resolveBidIncrement,
} from "@libs/auctionRules";
import type { AuctionDetailResponse } from "pages/api/auctions/[id]";
import type { BidResponse } from "pages/api/auctions/[id]/bid";
import { AuctionBloodlineRows } from "../AuctionBloodlineParts";

interface AuctionReportResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
  status?: number;
}

type MutationResult<T> = T & { message?: string; status?: number };

/** 마감 임박(주황 강조) 기준 */
const URGENT_MS = 10 * 60 * 1000;

const REPORT_REASONS = [
  "허위 매물 의심",
  "입찰 방해/분쟁 유도",
  "비정상 가격 유도",
  "욕설/부적절 내용",
  "기타",
] as const;

const getCountdown = (endAt: string | Date | undefined, now: number) => {
  const diff = endAt ? new Date(endAt).getTime() - now : Number.NaN;
  if (Number.isNaN(diff) || diff <= 0) return { text: "경매 종료", isEnded: true, diff: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return { text: `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`, isEnded: false, diff };
  if (hours > 0) return { text: `${hours}시간 ${minutes}분 ${seconds}초`, isEnded: false, diff };
  if (minutes > 0) return { text: `${minutes}분 ${seconds}초`, isEnded: false, diff };
  return { text: `${seconds}초`, isEnded: false, diff };
};

const formatPrice = (value: number) => `${value.toLocaleString("ko-KR")}원`;

/* ------------------------------------------------------------------ */
/* 작은 조각(앱 [id].tsx 와 같은 치수)                                     */
/* ------------------------------------------------------------------ */

function Divider() {
  return <div className="h-px bg-app-line" />;
}

const ICON_PATHS = {
  document:
    "M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184",
  send: "M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5",
  pencil:
    "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  chevronRight: "m8.25 4.5 7.5 7.5-7.5 7.5",
  chevronDown: "m19.5 8.25-7.5 7.5-7.5-7.5",
  image:
    "m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
  check: "m4.5 12.75 6 6 9-13.5",
} as const;

function Icon({ name, size, className }: { name: keyof typeof ICON_PATHS; size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d={ICON_PATHS[name]} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 32px 텍스트+아이콘 보조 버튼 */
const ACTION_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1 rounded-2xl bg-app-surface px-3 text-[13px] font-semibold text-app-text";

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: "document" | "send" | "pencil";
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={ACTION_BUTTON_CLASS}>
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}

/** 접히는 섹션 행 ("경매 규칙 ›") */
function CollapsibleRow({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-[52px] w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-semibold text-app-text">{title}</span>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={18} className="text-app-caption" />
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-2 text-left"
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
          checked ? "border-app-text bg-app-text text-app-bg" : "border-app-border bg-app-bg"
        )}
      >
        {checked ? <Icon name="check" size={12} /> : null}
      </span>
      <span className="flex-1 text-[12px] text-app-muted">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */

const AuctionDetailClient = () => {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const auctionId = params?.id ? extractAuctionIdFromPath(params.id) : Number.NaN;
  const canLoadAuction = Number.isFinite(auctionId);
  const isToolRoute = Boolean(pathname?.startsWith("/tool"));
  const loginPath = isToolRoute ? "/tool/login" : "/auth/login";

  const [now, setNow] = useState(() => Date.now());
  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [bidInput, setBidInput] = useState<number | null>(null);
  const [agreedBidRule, setAgreedBidRule] = useState(false);
  const [agreedDisputePolicy, setAgreedDisputePolicy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]>("허위 매물 의심");
  const [reportDetail, setReportDetail] = useState("");
  const [confirmBidAmount, setConfirmBidAmount] = useState<number | null>(null);
  // 관리자 ⋯ 조치(숨기기·숨김 해제·삭제). 웹 경매 상세는 관리자에게만 ⋯ 를 둔다(앱과 같음).
  const moderation = useAdminModeration();
  const [adminSheetOpen, setAdminSheetOpen] = useState(false);

  // 경매 데이터(5초 폴링). 폴링이 실패해도 SWR 은 받아 둔 data 를 그대로 둔다.
  const { data, error, mutate } = useSWR<AuctionDetailResponse>(
    canLoadAuction ? `/api/auctions/${auctionId}` : null,
    { refreshInterval: 5000 }
  );
  const [submitBid, { loading: bidLoading }] = useMutation<MutationResult<BidResponse>>(
    canLoadAuction ? `/api/auctions/${auctionId}/bid` : ""
  );
  const [submitReport, { loading: reportLoading }] = useMutation<AuctionReportResponse>(
    canLoadAuction ? `/api/auctions/${auctionId}/report` : ""
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const auction = data?.auction;

  useEffect(() => {
    if (!auction?.id) return;
    trackEvent(ANALYTICS_EVENTS.auctionDetailViewed, {
      auction_id: auction.id,
      auction_title: auction.title,
      auction_category: auction.category,
      auction_status: auction.status,
      current_price: auction.currentPrice,
      user_id: user?.id || null,
    });
    // 경매가 바뀔 때 한 번만 남긴다(폴링으로 현재가가 바뀌어도 다시 남기지 않는다).
     
  }, [auction?.id, user?.id]);

  const photos = useMemo(() => auction?.photos ?? [], [auction?.photos]);
  const safeImageIndex = photos.length ? Math.min(imageIndex, photos.length - 1) : 0;
  const countdown = getCountdown(auction?.endAt, now);
  const isUrgent = auction?.status === "진행중" && !countdown.isEnded && countdown.diff <= URGENT_MS;
  // 입찰 단위는 판매자가 등록 때 정한 값(경매 내내 고정).
  const bidIncrement = auction ? resolveBidIncrement(auction) : 0;
  const minimumBid = auction ? auction.currentPrice + bidIncrement : 0;
  const selectedBidAmount = bidInput && bidInput > 0 ? bidInput : minimumBid;
  const isOwner = Boolean(data?.isOwner);
  const canEdit = Boolean(data?.canEdit);
  const isTopBidder = Boolean(
    auction?.status === "진행중" && user?.id && auction?.bids?.[0]?.userId === user.id
  );
  const isBiddable = auction?.status === "진행중" && !countdown.isEnded && !isOwner && !isTopBidder;
  const extensionMinutes = Math.floor(AUCTION_EXTENSION_MS / (60 * 1000));
  const extensionWindowMinutes = Math.floor(AUCTION_EXTENSION_WINDOW_MS / (60 * 1000));
  const winnerBid = auction?.winnerId
    ? auction.bids.find((bid) => bid.userId === auction.winnerId) || auction.bids[0]
    : null;
  const isWinner = Boolean(auction?.winnerId && user?.id === auction.winnerId);
  const auctionPath = auction ? toAuctionPath(auction.id, auction.title) : "/auctions";

  const requireLogin = () => {
    if (user) return false;
    router.push(`${loginPath}?next=${encodeURIComponent(pathname || auctionPath)}`);
    return true;
  };

  const handleBid = () => {
    trackEvent(ANALYTICS_EVENTS.auctionBidStart, {
      auction_id: auction?.id || null,
      category: auction?.category || null,
      current_price: auction?.currentPrice || null,
      bloodline_root_id: auction?.bloodlineRootId || null,
    });
    trackEvent(ANALYTICS_EVENTS.auctionBidAttempted, {
      auction_id: auction?.id || null,
      user_id: user?.id || null,
      amount: selectedBidAmount,
      minimum_bid: minimumBid,
      current_price: auction?.currentPrice || null,
      agreed_bid_rule: agreedBidRule,
      agreed_dispute_policy: agreedDisputePolicy,
      is_top_bidder: isTopBidder,
      requires_login: !user,
    });
    if (!auction || bidLoading) return;
    if (requireLogin()) return;
    if (isTopBidder) {
      toast.error("현재 최고 입찰자는 다시 입찰할 수 없습니다.");
      return;
    }
    if (!agreedBidRule || !agreedDisputePolicy) {
      toast.error("입찰 전 주의사항 및 분쟁 정책 동의가 필요합니다.");
      return;
    }
    if (countdown.isEnded) {
      toast.error("이미 종료된 경매입니다.");
      return;
    }
    // 서버 BID_AMOUNT_RULE_VIOLATION 과 같은 기준·문구(최소 금액 이상 + 입찰 단위 배수).
    if (
      !Number.isInteger(selectedBidAmount) ||
      !isBidAmountValid({
        currentPrice: auction.currentPrice,
        bidAmount: selectedBidAmount,
        increment: bidIncrement,
      })
    ) {
      toast.error(
        `입찰 금액은 최소 ${minimumBid.toLocaleString()}원 이상이며 ${bidIncrement.toLocaleString()}원 단위여야 합니다.`
      );
      return;
    }
    setConfirmBidAmount(selectedBidAmount);
  };

  const placeBid = (amount: number) => {
    setConfirmBidAmount(null);
    submitBid({
      data: { amount },
      onCompleted(result) {
        if (result.success) {
          trackEvent(ANALYTICS_EVENTS.auctionBidSubmitted, {
            auction_id: auction?.id || null,
            user_id: user?.id || null,
            amount,
            extended: Boolean(result.extended),
            extension_minutes: result.extended ? extensionMinutes : 0,
          });
          setBidInput(null);
          toast.success("입찰이 완료되었습니다!");
          if (result.extended) {
            toast.info(`마감 임박 입찰로 경매 시간이 ${extensionMinutes}분 연장되었습니다.`);
          }
          void mutate();
          return;
        }
        trackEvent(ANALYTICS_EVENTS.auctionBidFailed, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          amount,
          error_code: result.errorCode || null,
          error_message: result.error || "입찰에 실패했습니다.",
        });
        // 종료·단위 위반·최고 입찰자 재입찰 등 서버 거절 사유를 보여 주고, 바뀐 현재가를 바로 다시 받는다.
        toast.error(getAuctionResultMessage(result, "입찰에 실패했습니다."));
        void mutate();
      },
      onError() {
        trackEvent(ANALYTICS_EVENTS.auctionBidFailed, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          amount,
          error_code: "network_error",
          error_message: "네트워크 연결을 확인해 주세요.",
        });
        toast.error("네트워크 연결을 확인해 주세요.");
      },
    }).catch(() => undefined);
  };

  const handleReport = () => {
    if (requireLogin() || reportLoading) return;
    if (reportDetail.trim().length < 5) {
      toast.error("신고 내용은 5자 이상 입력해주세요.");
      return;
    }
    submitReport({
      data: { reason: reportReason, detail: reportDetail.trim() },
      onCompleted(result) {
        if (!result.success) {
          trackEvent(ANALYTICS_EVENTS.auctionReportFailed, {
            auction_id: auction?.id || null,
            user_id: user?.id || null,
            report_reason: reportReason,
            error_code: result.errorCode || null,
            error_message: result.error || "신고 접수에 실패했습니다.",
          });
          toast.error(getAuctionResultMessage(result, "신고 접수에 실패했습니다."));
          return;
        }
        trackEvent(ANALYTICS_EVENTS.auctionReportSubmitted, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          report_reason: reportReason,
          detail_length: reportDetail.trim().length,
        });
        setReportDetail("");
        toast.success("신고가 접수되었습니다. 운영자가 검토 후 조치합니다.");
      },
      onError() {
        toast.error("신고 접수 중 오류가 발생했습니다.");
      },
    }).catch(() => undefined);
  };

  const copyAuctionLink = async () => {
    if (!auction) {
      toast.error("공유 링크를 생성하지 못했습니다.");
      return;
    }
    const url = absoluteUrl(auctionPath);
    if (await copyText(url)) {
      trackEvent(ANALYTICS_EVENTS.auctionLinkCopied, {
        auction_id: auction.id,
        user_id: user?.id || null,
        share_url: url,
      });
      toast.success("경매 링크가 복사되었습니다.");
    } else {
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  const shareAuction = async () => {
    if (!auction) {
      toast.error("공유 링크를 생성하지 못했습니다.");
      return;
    }
    const result = await shareOrCopy({ title: auction.title, url: auctionPath });
    if (result !== "failed") {
      trackEvent(ANALYTICS_EVENTS.auctionShared, {
        auction_id: auction.id,
        user_id: user?.id || null,
        channel: result === "shared" ? "navigator_share" : "clipboard_fallback",
        share_url: absoluteUrl(auctionPath),
      });
    }
  };

  // 삭제(404)·권한 없음(403)은 다시 받아도 같으므로 받아 둔 경매를 내린다.
  const errorStatus = (error as { status?: number } | undefined)?.status;
  const isGone = Boolean(error) && (errorStatus === 404 || errorStatus === 403);

  if (canLoadAuction && !auction && !error) {
    return (
      <Layout canGoBack title="경매" seoTitle="경매">
        <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="불러오는 중">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand" />
        </div>
      </Layout>
    );
  }

  if (!canLoadAuction || !auction || isGone) {
    const canRetry = canLoadAuction && Boolean(error) && !isGone;
    return (
      <Layout canGoBack title="경매" seoTitle="경매">
        <div className="flex h-[60vh] items-center justify-center px-6">
          {canRetry ? (
            <QueryErrorState onRetry={() => void mutate()} />
          ) : (
            <p className="text-center text-[15px] text-app-muted">경매를 불러올 수 없습니다.</p>
          )}
        </div>
      </Layout>
    );
  }

  const statusNotice =
    auction.status === "진행중"
      ? null
      : auction.status === "종료"
      ? "경매가 종료되었습니다."
      : auction.status === "취소"
      ? "운영 처리로 경매가 중단(취소)되었습니다."
      : "유찰되었습니다.";

  const hasSellerTrustInfo = Boolean(
    auction.sellerPhone ||
      auction.sellerEmail ||
      auction.sellerBlogUrl ||
      auction.sellerCafeNick ||
      auction.sellerBandNick ||
      auction.sellerTrustNote ||
      auction.sellerProofImage
  );
  const bidDisabled = bidLoading || !isBiddable || !agreedBidRule || !agreedDisputePolicy;
  // 판매자가 탈퇴해 user 가 없거나 탈퇴 이름이면 프로필 링크 없이 "탈퇴한 사용자"로 보인다.
  const sellerId = auction.user?.id;
  const sellerDeleted = !sellerId || isDeletedUserName(auction.user?.name);
  const sellerName = sellerDeleted ? DELETED_USER_LABEL : auction.user?.name;
  const programs = sellerDeleted ? undefined : auction.user?.breederPrograms;
  const framed = hasBreederProgramFrame(programs);

  const sellerInner = (
    <>
      <div className={cn("shrink-0", framed && "rounded-full p-0.5", framed && getBreederProgramFrameClassName(programs))}>
        {!sellerDeleted && auction.user?.avatar ? (
          <Image
            src={makeImageUrl(auction.user.avatar, "avatar")}
            className="h-11 w-11 rounded-full object-cover"
            width={44}
            height={44}
            alt=""
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-app-surface" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[16px] font-semibold text-app-text">{sellerName}</p>
        <p className="text-[13px] text-app-muted">경매 등록자</p>
        <BreederProgramBadge programs={programs} className="mt-1" />
      </div>
    </>
  );

  const adminActions = isOwner
    ? []
    : moderation.actionsFor({
        targetType: "AUCTION",
        targetId: auction.id,
        isHidden: Boolean(auction.isHidden),
        refreshDetail: () => void mutate(),
        onDeleted: () => router.replace("/auctions"),
      });

  return (
    <Layout
      canGoBack
      title={auction.title}
      seoTitle={auction.title}
      headerRight={
        adminActions.length > 0 ? (
          <HeaderIconButton label="더보기" onClick={() => setAdminSheetOpen(true)}>
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </HeaderIconButton>
        ) : undefined
      }
    >
      <div className="bg-app-bg pb-[calc(200px+env(safe-area-inset-bottom))]">
        {auction.isHidden ? <HiddenContentNotice targetType="AUCTION" className="mx-4 my-3" /> : null}
        {/* 이미지: 화면 폭 정사각 */}
        <div className="relative">
          {photos.length ? (
            <ImageCarousel
              images={photos}
              index={safeImageIndex}
              onIndexChange={setImageIndex}
              onOpen={(i) => {
                setImageIndex(i);
                setViewerOpen(true);
              }}
              aspect="1/1"
              alt="경매 이미지"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-app-surface text-app-caption">
              <Icon name="image" size={40} />
            </div>
          )}
          <span className="pointer-events-none absolute left-3 top-3 rounded-[14px] bg-black/70 px-2.5 py-[5px] text-[12px] text-white">
            {auction.status}
          </span>
        </div>

        {/* 판매자 행 */}
        {isToolRoute || sellerDeleted ? (
          <div className="flex items-center gap-3 p-4">{sellerInner}</div>
        ) : (
          <Link href={`/profiles/${sellerId}`} className="flex items-center gap-3 p-4">
            {sellerInner}
            <Icon name="chevronRight" size={20} className="shrink-0 text-app-caption" />
          </Link>
        )}

        <Divider />

        {/* 혈통 행(판매자 행 바로 아래) + 판매자에게만 낙찰자 출처 카드 보내기 제안. 경매 도구에는 두지 않는다. */}
        {!isToolRoute ? (
          <AuctionBloodlineRows
            auctionId={auction.id}
            bloodline={auction.bloodline}
            pedigreeNote={auction.pedigreeNote}
            isOwner={isOwner}
            status={auction.status}
            winnerId={auction.winnerId}
            winnerName={winnerBid?.user?.name}
          />
        ) : null}

        {/* 제목·설명 */}
        <div className="flex flex-col gap-2.5 p-4">
          {auction.category ? (
            <div className="flex">
              <span className="rounded-xl bg-app-surface px-2 py-1 text-[12px] text-app-muted">{auction.category}</span>
            </div>
          ) : null}
          <h1 className="break-keep text-[18px] font-bold text-app-text [overflow-wrap:anywhere]">{auction.title}</h1>
          <p className="whitespace-pre-line break-words text-[15px] leading-[22px] text-app-text [overflow-wrap:anywhere]">
            {auction.description}
          </p>

          {statusNotice ? <p className="text-[13px] text-app-muted">{statusNotice}</p> : null}

          {auction.status === "종료" && winnerBid ? (
            <div className="flex flex-col gap-0.5 text-[13px] text-app-muted">
              <p>
                {isWinner ? "낙찰 완료" : "낙찰자"}: {winnerBid.user?.name}
              </p>
              <p>낙찰가: {formatPrice(winnerBid.amount)}</p>
              <p>종료시각: {new Date(auction.endAt).toLocaleString("ko-KR")}</p>
            </div>
          ) : null}

          <div className="mt-0.5 flex flex-wrap gap-2">
            {isOwner && canEdit && !isToolRoute ? (
              <Link href={`${auctionPath}/edit`} className={ACTION_BUTTON_CLASS}>
                <Icon name="pencil" size={14} />
                경매 수정하기
              </Link>
            ) : null}
            <ActionButton icon="document" label="링크 복사" onClick={() => void copyAuctionLink()} />
            <ActionButton icon="send" label="공유하기" onClick={() => void shareAuction()} />
          </div>

          {isOwner && !canEdit ? (
            <p className="text-[13px] text-app-muted">
              진행중 상태에서 등록 후 10분 이내, 입찰이 없을 때만 수정할 수 있습니다.
            </p>
          ) : null}
        </div>

        <Divider />

        {/* 가격 블록 */}
        <div className="flex flex-col gap-1.5 p-4">
          <p className="text-[13px] text-app-muted">시작가 {formatPrice(auction.startPrice)}</p>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-[13px] text-app-muted">현재 최고가</p>
              <p className="text-[22px] font-bold text-app-text">{formatPrice(auction.currentPrice)}</p>
            </div>
            <p className={cn("text-[14px] font-semibold", isUrgent ? "text-app-brand" : "text-app-text")}>
              {auction.status === "진행중" ? countdown.text : "경매 종료"}
            </p>
          </div>
        </div>

        <Divider />

        {/* 경매 규칙(접힘) */}
        <div className="px-4">
          <CollapsibleRow title="경매 규칙" open={rulesOpen} onToggle={() => setRulesOpen((v) => !v)}>
            <div className="flex flex-col gap-1.5 text-[13px] leading-5 text-app-muted">
              <p>입찰 단위 {formatPrice(bidIncrement)}</p>
              <p>
                마감 {extensionWindowMinutes}분 이내 입찰 시 종료 시간이 {extensionMinutes}분 연장됩니다.
              </p>
              <p>입찰은 취소할 수 없으며, 본인 경매 입찰은 불가합니다.</p>
              <p>현재 최고 입찰자는 재입찰할 수 없습니다.</p>
              <p>본 서비스는 거래 당사자 간 분쟁에 법적 책임을 지지 않습니다.</p>
              {!isToolRoute ? (
                <Link href="/auctions/rules" className="flex h-8 items-center text-[13px] font-semibold text-app-text">
                  규칙 전체 보기
                </Link>
              ) : null}
            </div>
          </CollapsibleRow>
        </div>

        <Divider />

        {/* 판매자 신뢰 정보 */}
        {hasSellerTrustInfo ? (
          <>
            <div className="flex flex-col gap-1.5 p-4 text-[13px] text-app-muted">
              <p className="text-[15px] font-semibold text-app-text">판매자 정보</p>
              {auction.sellerPhone ? <p>연락처 {auction.sellerPhone}</p> : null}
              {auction.sellerEmail ? <p>이메일 {auction.sellerEmail}</p> : null}
              {auction.sellerBlogUrl ? (
                <p className="break-all">
                  블로그/프로필{" "}
                  <a href={auction.sellerBlogUrl} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
                    {auction.sellerBlogUrl}
                  </a>
                </p>
              ) : null}
              {auction.sellerCafeNick ? <p>카페 닉네임 {auction.sellerCafeNick}</p> : null}
              {auction.sellerBandNick ? <p>밴드 닉네임 {auction.sellerBandNick}</p> : null}
              {auction.sellerTrustNote ? (
                <p className="whitespace-pre-line break-words leading-5 [overflow-wrap:anywhere]">{auction.sellerTrustNote}</p>
              ) : null}
              {auction.sellerProofImage ? (
                <div className="relative mt-1 h-28 w-40 overflow-hidden rounded-lg bg-app-surface">
                  <Image
                    src={makeImageUrl(auction.sellerProofImage, "public")}
                    className="object-contain"
                    fill
                    sizes="160px"
                    alt="판매자 신뢰 자료"
                  />
                </div>
              ) : null}
            </div>
            <Divider />
          </>
        ) : null}

        {/* 입찰 내역 */}
        <div className="px-4 pt-4">
          <h2 className="text-[15px] font-semibold text-app-text">입찰 내역 {auction._count.bids}건</h2>
        </div>
        {auction.bids.length > 0 ? (
          <ul className="mt-1 px-4">
            {auction.bids.map((bid, index) => (
              <li
                key={bid.id}
                className={cn(
                  "flex h-12 items-center justify-between gap-3",
                  index !== auction.bids.length - 1 && "border-b border-app-line"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-[14px] text-app-text">{bid.user?.name}</span>
                  {index === 0 ? (
                    <span className="shrink-0 text-[12px] text-app-muted">
                      {auction.status === "종료" && auction.winnerId === bid.userId ? "낙찰" : "최고가"}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[14px] font-semibold text-app-text">{formatPrice(bid.amount)}</span>
                  <span className="text-[12px] text-app-muted">{getTimeAgoString(new Date(bid.createdAt))}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-[13px] text-app-muted">아직 입찰 내역이 없습니다.</p>
        )}

        {/* 신고(접힘) */}
        {!isOwner ? (
          <>
            <div className="mt-4 h-2 bg-app-gap" />
            <div className="px-4">
              <CollapsibleRow title="신고하기" open={reportOpen} onToggle={() => setReportOpen((v) => !v)}>
                <div className="flex flex-col gap-2">
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value as (typeof REPORT_REASONS)[number])}
                    aria-label="신고 사유 선택"
                    className="h-12 w-full rounded-lg border border-app-border bg-app-bg px-3.5 text-[15px] text-app-text focus:border-app-text focus:outline-none focus:ring-0"
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={reportDetail}
                    onChange={(event) => setReportDetail(event.target.value)}
                    placeholder="신고 내용을 5자 이상 입력해주세요."
                    maxLength={500}
                    className="min-h-[80px] w-full resize-none rounded-lg border border-app-border bg-app-bg px-3.5 py-3 text-[14px] text-app-text placeholder:text-app-caption focus:border-app-text focus:outline-none focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={reportLoading}
                    className="h-10 self-start rounded-lg bg-app-surface px-4 text-[13px] font-semibold text-app-text disabled:opacity-60"
                  >
                    {reportLoading ? "접수 중..." : "신고 접수"}
                  </button>
                </div>
              </CollapsibleRow>
            </div>
          </>
        ) : null}
      </div>

      {/* 하단 고정 입찰 바 */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-40 border-t border-app-line bg-app-bg">
        <div className="mx-auto flex max-w-xl flex-col gap-2 px-4 pt-2.5 pb-[max(14px,calc(env(safe-area-inset-bottom)+10px))]">
          {isBiddable ? (
            <div className="flex flex-col gap-1.5">
              <CheckboxRow
                checked={agreedBidRule}
                onToggle={() => setAgreedBidRule((v) => !v)}
                label="입찰 취소 불가, 마감 임박 자동연장 규칙을 확인했습니다."
              />
              <CheckboxRow
                checked={agreedDisputePolicy}
                onToggle={() => setAgreedDisputePolicy((v) => !v)}
                label="분쟁 책임 제한 및 신고 접수 정책을 확인했습니다."
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <PriceInput
              value={bidInput}
              onChange={setBidInput}
              disabled={!isBiddable}
              placeholder={`최소 ${minimumBid.toLocaleString("ko-KR")}원`}
              aria-label="입찰 금액"
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={handleBid}
              disabled={bidDisabled}
              className={cn(
                "h-[52px] min-w-[112px] shrink-0 rounded-md px-5 text-[16px] font-semibold",
                bidDisabled ? "bg-app-surface text-app-caption" : "bg-app-brand text-white"
              )}
            >
              {bidLoading ? "입찰 중..." : "입찰하기"}
            </button>
          </div>
          {isOwner ? (
            <p className="text-[13px] text-app-muted">본인이 등록한 경매에는 입찰할 수 없습니다.</p>
          ) : isTopBidder ? (
            <p className="text-[13px] text-app-muted">현재 최고 입찰자는 다시 입찰할 수 없습니다.</p>
          ) : auction.status !== "진행중" || countdown.isEnded ? (
            <p className="text-[13px] text-app-muted">종료된 경매입니다.</p>
          ) : null}
        </div>
      </div>

      <ImageLightbox
        images={photos.map((photo) => makeImageUrl(photo, "public"))}
        isOpen={viewerOpen}
        currentIndex={safeImageIndex}
        onClose={() => setViewerOpen(false)}
        onIndexChange={setImageIndex}
        altPrefix="경매 이미지"
      />

      <ConfirmDialog
        open={confirmBidAmount !== null}
        title="입찰 확인"
        description={
          confirmBidAmount !== null
            ? `정말 ${confirmBidAmount.toLocaleString()}원으로 입찰하시겠습니까?\n입찰 취소가 불가능합니다.`
            : undefined
        }
        confirmText="입찰"
        onConfirm={() => {
          if (confirmBidAmount !== null) placeBid(confirmBidAmount);
        }}
        onCancel={() => setConfirmBidAmount(null)}
      />
      <ActionSheet open={adminSheetOpen} onClose={() => setAdminSheetOpen(false)} actions={adminActions} />
      {moderation.confirmDialog}
    </Layout>
  );
};

export default AuctionDetailClient;
