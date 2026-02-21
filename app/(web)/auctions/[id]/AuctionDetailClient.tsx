"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { cn, makeImageUrl, getTimeAgoString } from "@libs/client/utils";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { AuctionDetailResponse } from "pages/api/auctions/[id]";
import { BidResponse } from "pages/api/auctions/[id]/bid";
import {
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  getBidIncrement,
} from "@libs/auctionRules";
import { getAuctionErrorMessage } from "@libs/client/auctionErrorMessage";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { extractAuctionIdFromPath, toAuctionPath } from "@libs/auction-route";
import ImageLightbox from "@components/features/image/ImageLightbox";

const DETAIL_FALLBACK_IMAGE = "/images/placeholders/minimal-gray-blur.svg";

interface AuctionReportResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
}

const REPORT_REASONS = [
  "허위 매물 의심",
  "입찰 방해/분쟁 유도",
  "비정상 가격 유도",
  "욕설/부적절 내용",
  "기타",
] as const;

/** 카운트다운 문자열 */
const getCountdown = (endAt: string | Date) => {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return { text: "경매 종료", isEnded: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  let text = "";
  if (days > 0) text = `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
  else if (hours > 0) text = `${hours}시간 ${minutes}분 ${seconds}초`;
  else if (minutes > 0) text = `${minutes}분 ${seconds}초`;
  else text = `${seconds}초`;

  return { text, isEnded: false };
};

const AuctionDetailClient = () => {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const auctionId = params?.id ? extractAuctionIdFromPath(params.id) : Number.NaN;
  const [bidAmount, setBidAmount] = useState<number | null>(null);
  const [countdown, setCountdown] = useState({ text: "", isEnded: false });
  const [imageIndex, setImageIndex] = useState(0);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [agreedBidRule, setAgreedBidRule] = useState(false);
  const [agreedDisputePolicy, setAgreedDisputePolicy] = useState(false);
  const [reportReason, setReportReason] =
    useState<(typeof REPORT_REASONS)[number]>("허위 매물 의심");
  const [reportDetail, setReportDetail] = useState("");
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isImageDragging = useRef(false);

  // 경매 데이터 (5초 간격 새로고침)
  const { data, mutate: boundMutate } = useSWR<AuctionDetailResponse>(
    Number.isNaN(auctionId) ? null : `/api/auctions/${auctionId}`,
    { refreshInterval: 5000 }
  );

  // 입찰 API
  const [submitBid, { loading: bidLoading }] = useMutation<BidResponse>(
    Number.isNaN(auctionId) ? "" : `/api/auctions/${auctionId}/bid`
  );
  const [submitReport, { loading: reportLoading }] =
    useMutation<AuctionReportResponse>(
      Number.isNaN(auctionId) ? "" : `/api/auctions/${auctionId}/report`
    );

  // 1초마다 카운트다운 갱신
  useEffect(() => {
    if (!data?.auction?.endAt) return;
    const timer = setInterval(() => {
      setCountdown(getCountdown(data.auction!.endAt));
    }, 1000);
    setCountdown(getCountdown(data.auction.endAt));
    return () => clearInterval(timer);
  }, [data?.auction?.endAt]);

  useEffect(() => {
    if (!data?.auction?.id) return;
    trackEvent(ANALYTICS_EVENTS.auctionDetailViewed, {
      auction_id: data.auction.id,
      auction_title: data.auction.title,
      auction_category: data.auction.category,
      auction_status: data.auction.status,
      current_price: data.auction.currentPrice,
      user_id: user?.id || null,
    });
  }, [
    data?.auction?.id,
    data?.auction?.title,
    data?.auction?.category,
    data?.auction?.status,
    data?.auction?.currentPrice,
    user?.id,
  ]);

  const auction = data?.auction;
  const extensionMinutes = Math.floor(AUCTION_EXTENSION_MS / (60 * 1000));
  const extensionWindowMinutes = Math.floor(
    AUCTION_EXTENSION_WINDOW_MS / (60 * 1000)
  );
  const winnerBid = auction?.winnerId
    ? auction.bids.find((bid) => bid.userId === auction.winnerId) || auction.bids[0]
    : null;
  const isWinner = Boolean(auction?.winnerId && user?.id === auction.winnerId);
  const bidIncrement = auction ? getBidIncrement(auction.currentPrice) : 0;
  const minimumBid = auction ? auction.currentPrice + bidIncrement : 0;
  const isTopBidder = Boolean(
    auction?.status === "진행중" && user?.id && auction?.bids?.[0]?.userId === user.id
  );
  const selectedBidAmount = bidAmount ?? minimumBid;

  const isToolRoute = pathname?.startsWith("/tool");
  const loginPath = isToolRoute ? "/tool/login" : "/auth/login";
  const hasBottomBidLayer = auction?.status === "진행중" && !data?.isOwner;
  const mainImageSrc =
    auction?.photos?.[imageIndex]
      ? makeImageUrl(auction.photos[imageIndex], "public")
      : DETAIL_FALLBACK_IMAGE;
  const auctionImageUrls =
    auction?.photos?.length && auction.photos.length > 0
      ? auction.photos.map((photo) => makeImageUrl(photo, "public"))
      : [DETAIL_FALLBACK_IMAGE];

  useEffect(() => {
    setImageIndex((prev) => {
      if (auctionImageUrls.length === 0) return 0;
      return Math.min(prev, auctionImageUrls.length - 1);
    });
  }, [auctionImageUrls.length]);


  const handleImageTouchStart = (event: React.TouchEvent) => {
    isImageDragging.current = false;
    touchStartX.current = event.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleImageTouchMove = (event: React.TouchEvent) => {
    const movedX = event.targetTouches[0].clientX;
    const startX = touchStartX.current;
    if (startX !== null && Math.abs(startX - movedX) > 10) {
      isImageDragging.current = true;
    }
    touchEndX.current = movedX;
  };

  const handleImageTouchEnd = () => {
    const startX = touchStartX.current;
    const endX = touchEndX.current;

    touchStartX.current = null;
    touchEndX.current = null;

    if (startX === null || endX === null) return;

    const distance = startX - endX;
    if (distance > 50) {
      setImageIndex((prev) => (prev + 1) % auctionImageUrls.length);
      return;
    }
    if (distance < -50) {
      setImageIndex((prev) => (prev - 1 + auctionImageUrls.length) % auctionImageUrls.length);
      return;
    }

    isImageDragging.current = false;
  };

  const normalizeBidAmount = (targetAmount: number) => {
    if (!auction) return 0;

    const basePrice = auction.currentPrice;
    const increment = getBidIncrement(basePrice);
    const minAmount = basePrice + increment;

    if (!Number.isFinite(targetAmount) || targetAmount <= minAmount) return minAmount;

    const steps = Math.ceil((targetAmount - basePrice) / increment);
    return basePrice + steps * increment;
  };

  const increaseBidAmount = (delta: number) => {
    if (!auction) return;
    setBidAmount((prev) => {
      const baseAmount = prev ?? auction.currentPrice;
      const nextAmount = normalizeBidAmount(baseAmount + delta);
      trackEvent(ANALYTICS_EVENTS.auctionBidAmountAdjusted, {
        auction_id: auction.id,
        user_id: user?.id || null,
        delta,
        previous_amount: baseAmount,
        next_amount: nextAmount,
      });
      return nextAmount;
    });
  };

  useEffect(() => {
    if (!auction) return;
    setBidAmount((prev) => {
      if (prev === null) return null;
      if (prev < minimumBid) return minimumBid;
      return normalizeBidAmount(prev);
    });
  }, [auction, minimumBid]);

  /** 입찰 핸들러 */
  const handleBid = () => {
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

    if (!user) return router.push(`${loginPath}?next=${encodeURIComponent(pathname || "/")}`);
    if (bidLoading) return;
    if (isTopBidder) {
      toast.error("현재 최고 입찰자는 다시 입찰할 수 없습니다.");
      return;
    }
    if (!agreedBidRule || !agreedDisputePolicy) {
      toast.error("입찰 전 주의사항 및 분쟁 정책 동의가 필요합니다.");
      return;
    }

    const amount = selectedBidAmount;
    if (!Number.isInteger(amount) || amount < minimumBid) {
      toast.error(`최소 ${minimumBid.toLocaleString()}원 이상 입찰해야 합니다.`);
      return;
    }

    const confirmed = window.confirm(
      `정말 ${amount.toLocaleString()}원으로 입찰하시겠습니까?\n입찰 취소가 불가능합니다.`
    );
    if (!confirmed) {
      return;
    }

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
          toast.success("입찰이 완료되었습니다!");
          if (result.extended) {
            toast.info(`마감 임박 입찰로 경매 시간이 ${extensionMinutes}분 연장되었습니다.`);
          }
          setBidAmount(null);
          boundMutate();
        } else {
          trackEvent(ANALYTICS_EVENTS.auctionBidFailed, {
            auction_id: auction?.id || null,
            user_id: user?.id || null,
            amount,
            error_code: result.errorCode || null,
            error_message: result.error || "입찰에 실패했습니다.",
          });
          toast.error(getAuctionErrorMessage(result.errorCode, result.error || "입찰에 실패했습니다."));
        }
      },
      onError() {
        trackEvent(ANALYTICS_EVENTS.auctionBidFailed, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          amount,
          error_code: "network_error",
          error_message: "오류가 발생했습니다.",
        });
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  const getAuctionUrl = () => {
    if (!auction || typeof window === "undefined") return "";
    return new URL(toAuctionPath(auction.id, auction.title), window.location.origin).toString();
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopyAuctionLink = async () => {
    try {
      const url = getAuctionUrl();
      if (!url) {
        toast.error("공유 링크를 생성하지 못했습니다.");
        return;
      }
      await copyToClipboard(url);
      trackEvent(ANALYTICS_EVENTS.auctionLinkCopied, {
        auction_id: auction?.id || null,
        user_id: user?.id || null,
        share_url: url,
      });
      toast.success("경매 링크가 복사되었습니다.");
    } catch {
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  const handleShareAuction = async () => {
    try {
      const url = getAuctionUrl();
      if (!url) {
        toast.error("공유 링크를 생성하지 못했습니다.");
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: auction?.title || "경매 상세",
          text: "경매 상세 내용을 확인해보세요.",
          url,
        });
        trackEvent(ANALYTICS_EVENTS.auctionShared, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          channel: "navigator_share",
          share_url: url,
        });
        toast.success("공유를 완료했습니다.");
        return;
      }

      await copyToClipboard(url);
      trackEvent(ANALYTICS_EVENTS.auctionShared, {
        auction_id: auction?.id || null,
        user_id: user?.id || null,
        channel: "clipboard_fallback",
        share_url: url,
      });
      toast.info("이 기기에서는 바로 공유를 지원하지 않아 링크를 복사했습니다.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("공유에 실패했습니다.");
    }
  };

  const handleReport = () => {
    if (!user) {
      router.push(`${loginPath}?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (reportDetail.trim().length < 5) {
      toast.error("신고 내용은 5자 이상 입력해주세요.");
      return;
    }

    submitReport({
      data: {
        reason: reportReason,
        detail: reportDetail.trim(),
      },
      onCompleted(result) {
        if (!result.success) {
          trackEvent(ANALYTICS_EVENTS.auctionReportFailed, {
            auction_id: auction?.id || null,
            user_id: user?.id || null,
            report_reason: reportReason,
            error_code: result.errorCode || null,
            error_message: result.error || "신고 접수에 실패했습니다.",
          });
          toast.error(getAuctionErrorMessage(result.errorCode, result.error || "신고 접수에 실패했습니다."));
          return;
        }
        trackEvent(ANALYTICS_EVENTS.auctionReportSubmitted, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          report_reason: reportReason,
          detail_length: reportDetail.trim().length,
        });
        toast.success("신고가 접수되었습니다. 운영자가 검토 후 조치합니다.");
        setReportDetail("");
      },
      onError() {
        trackEvent(ANALYTICS_EVENTS.auctionReportFailed, {
          auction_id: auction?.id || null,
          user_id: user?.id || null,
          report_reason: reportReason,
          error_code: "network_error",
          error_message: "신고 접수 중 오류가 발생했습니다.",
        });
        toast.error("신고 접수 중 오류가 발생했습니다.");
      },
    });
  };

  if (!auction) {
    return (
      <Layout canGoBack title="경매" seoTitle="경매">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout canGoBack title={auction.title} seoTitle={auction.title}>
      <div
        className={cn(
          "pb-24",
          hasBottomBidLayer && "pb-[calc(20rem+env(safe-area-inset-bottom))]"
        )}
      >
        {/* 이미지 슬라이더 */}
        <div
          className="group relative aspect-[4/3] bg-gray-100 dark:bg-slate-800 cursor-zoom-in"
          onTouchStart={handleImageTouchStart}
          onTouchMove={handleImageTouchMove}
          onTouchEnd={handleImageTouchEnd}
          onClick={() => {
            if (isImageDragging.current) {
              isImageDragging.current = false;
              return;
            }
            setIsImageLightboxOpen(true);
          }}
        >
          <Image
            src={mainImageSrc}
            fallbackSrc={DETAIL_FALLBACK_IMAGE}
            className="object-contain p-2"
            alt={auction.title}
            fill
            sizes="600px"
            priority
            quality={100}
          />
          {auction.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setImageIndex((prev) => (prev - 1 + auction.photos.length) % auction.photos.length);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition-all hover:bg-black/55 md:opacity-0 md:group-hover:opacity-100"
                aria-label="이전 이미지"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setImageIndex((prev) => (prev + 1) % auction.photos.length);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition-all hover:bg-black/55 md:opacity-0 md:group-hover:opacity-100"
                aria-label="다음 이미지"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {auction.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={(event) => {
                      event.stopPropagation();
                      setImageIndex(i);
                    }}
                    className={cn(
                      "h-2 w-2 rounded-full transition-all",
                      imageIndex === i ? "bg-white dark:bg-white" : "bg-white/50 dark:bg-white/50"
                    )}
                    aria-label={`${i + 1}번 이미지로 이동`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <ImageLightbox
        images={auctionImageUrls}
        isOpen={isImageLightboxOpen}
        currentIndex={imageIndex}
        onClose={() => setIsImageLightboxOpen(false)}
        onIndexChange={setImageIndex}
        altPrefix="경매 이미지"
        />

        <div className="px-4">
          {/* 카운트다운 배너 */}
          <div
            className={cn(
              "mt-4 py-3 px-4 rounded-xl text-center font-bold",
              countdown.isEnded || auction.status !== "진행중"
                ? "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-300"
                : "bg-red-50 text-red-600 dark:bg-rose-950/40 dark:text-rose-300"
            )}
          >
            {auction.status === "진행중" ? (
              <div>
                <span className="text-xs font-medium block mb-0.5">남은 시간</span>
                <span className="text-lg">{countdown.text}</span>
              </div>
            ) : (
              <span className="text-base">
                {auction.status === "종료"
                  ? "경매가 종료되었습니다"
                  : auction.status === "취소"
                    ? "운영 처리로 경매가 중단(취소)되었습니다"
                    : "유찰되었습니다"}
              </span>
            )}
          </div>

          {auction.status === "취소" && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 dark:border-rose-800 dark:bg-rose-950/40">
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">신고/운영 처리로 경매 중단</p>
              <p className="mt-1 text-xs leading-relaxed text-rose-900 dark:text-rose-200/90">
                이 경매는 운영 정책에 따라 취소되었습니다. 추가 이의가 있으면 신고 접수 채널로 문의해 주세요.
              </p>
            </div>
          )}

          {auction.status === "종료" && winnerBid && (
            <div
              className={cn(
                "mt-3 rounded-xl border px-3.5 py-3",
                isWinner
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35"
                  : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/35"
              )}
            >
              <p
                className={cn(
                  "text-sm font-bold",
                  isWinner ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200"
                )}
              >
                {isWinner ? "낙찰 완료: 축하합니다!" : "낙찰 결과"}
              </p>
              <div className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-200">
                <p>낙찰자: {winnerBid.user?.name}</p>
                <p>낙찰가: {winnerBid.amount.toLocaleString()}원</p>
                <p>종료시각: {new Date(auction.endAt).toLocaleString()}</p>
              </div>
              <div className="mt-2 rounded-lg border border-white/80 bg-white/80 px-2.5 py-2 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                {isWinner ? (
                  <p>
                    판매자 신뢰 정보(전화/이메일/블로그)를 확인해 거래를 진행하세요. 분쟁 발생 시 신고 기능을 사용하세요.
                  </p>
                ) : data?.isOwner ? (
                  <p>
                    낙찰자와 거래를 진행하세요. 거래 조건 분쟁이 있으면 신고 접수로 운영 검토를 요청할 수 있습니다.
                  </p>
                ) : (
                  <p>
                    경매가 낙찰로 종료되었습니다. 참여 내역은 알림에서 확인할 수 있습니다.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 판매자 정보 */}
          {isToolRoute ? (
            <div className="flex items-center gap-3 border-b border-gray-100 py-4 dark:border-slate-800">
              {auction.user?.avatar ? (
                <Image
                  src={makeImageUrl(auction.user.avatar, "avatar")}
                  className="w-10 h-10 rounded-full object-cover"
                  width={40}
                  height={40}
                  alt=""
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-slate-700" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{auction.user?.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">경매 등록자</p>
              </div>
            </div>
          ) : (
            <Link
              href={`/profiles/${auction.user?.id}`}
              className="flex items-center gap-3 border-b border-gray-100 py-4 dark:border-slate-800"
            >
              {auction.user?.avatar ? (
                <Image
                  src={makeImageUrl(auction.user.avatar, "avatar")}
                  className="w-10 h-10 rounded-full object-cover"
                  width={40}
                  height={40}
                  alt=""
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-slate-700" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{auction.user?.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">경매 등록자</p>
              </div>
            </Link>
          )}

          {/* 상품 정보 */}
          <div className="space-y-3 border-b border-gray-100 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {auction.category && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {auction.category}
                </span>
              )}
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  auction.status === "진행중"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-300"
                )}
              >
                {auction.status}
              </span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 break-words [overflow-wrap:anywhere] dark:text-slate-50">
              {auction.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line leading-relaxed break-words [overflow-wrap:anywhere]">
              {auction.description}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {data?.isOwner && data?.canEdit && !isToolRoute ? (
                <Link
                  href={`${toAuctionPath(auction.id, auction.title)}/edit`}
                  className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  경매 수정하기
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleCopyAuctionLink}
                className="inline-flex h-10 items-center rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
              >
                링크 복사
              </button>
              <button
                type="button"
                onClick={handleShareAuction}
                className="inline-flex h-10 items-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
              >
                공유하기
              </button>
            </div>
            {data?.isOwner && !data?.canEdit ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                진행중 상태에서 등록 후 10분 이내, 입찰이 없을 때만 수정할 수 있습니다.
              </p>
            ) : null}
            {(auction.sellerPhone ||
              auction.sellerEmail ||
              auction.sellerBlogUrl ||
              auction.sellerCafeNick ||
              auction.sellerBandNick ||
              auction.sellerTrustNote ||
              auction.sellerProofImage) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">판매자 신뢰 정보</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {auction.sellerPhone ? <p>연락처: {auction.sellerPhone}</p> : null}
                  {auction.sellerEmail ? <p>이메일: {auction.sellerEmail}</p> : null}
                  {auction.sellerBlogUrl ? (
                    <a
                      href={auction.sellerBlogUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex underline underline-offset-2"
                    >
                      블로그/프로필 링크 확인
                    </a>
                  ) : null}
                  {auction.sellerCafeNick ? <p>카페 닉네임: {auction.sellerCafeNick}</p> : null}
                  {auction.sellerBandNick ? <p>밴드 닉네임: {auction.sellerBandNick}</p> : null}
                  {auction.sellerTrustNote ? (
                    <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                      추가 안내: {auction.sellerTrustNote}
                    </p>
                  ) : null}
                </div>
                {auction.sellerProofImage ? (
                  <div className="relative mt-2 h-28 w-40 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                    <Image
                      src={makeImageUrl(auction.sellerProofImage, "public")}
                      className="object-contain p-2"
                      fill
                      alt="판매자 신뢰 자료"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* 입찰 현황 */}
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">시작가</p>
                <p className="text-sm text-gray-500 dark:text-slate-300">{auction.startPrice.toLocaleString()}원</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 dark:text-slate-500">현재 최고가</p>
                <p className="text-2xl font-bold text-primary">
                  {auction.currentPrice.toLocaleString()}원
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">경매 규칙</p>
                {!isToolRoute ? (
                  <Link
                    href="/auctions/rules"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 underline underline-offset-2"
                  >
                    전체 보기
                  </Link>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <li>• 현재가 기준 입찰 단위: {getBidIncrement(auction.currentPrice).toLocaleString()}원</li>
                <li>• 마감 {extensionWindowMinutes}분 이내 입찰 시 종료 시간이 {extensionMinutes}분 연장됩니다.</li>
                <li>• 입찰은 취소할 수 없으며, 본인 경매 입찰은 불가합니다.</li>
                <li>• 현재 최고 입찰자는 재입찰할 수 없습니다.</li>
              </ul>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">분쟁/신고 안내</p>
                <p className="mt-1 leading-relaxed">
                  본 서비스는 거래 당사자 간 분쟁에 대해 법적 책임을 지지 않습니다.
                  다만 문제가 발생하면 신고를 접수하여 운영정책에 따라 검토 및 제재를 진행합니다.
                </p>
                <p className="mt-1 leading-relaxed font-semibold">
                  카카오 로그인 기반 계정은 위반 시 영구 참여 제한됩니다.
                </p>
                {!isToolRoute ? (
                  <a
                    href="mailto:bredyteam@gmail?subject=[경매%20신고]%20분쟁%20접수"
                    className="mt-1.5 inline-flex items-center font-semibold underline underline-offset-2"
                  >
                    신고 접수: bredyteam@gmail
                  </a>
                ) : null}
                {!data?.isOwner && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-2.5 dark:border-amber-700 dark:bg-slate-900/65">
                    <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">빠른 신고 접수</p>
                    <div className="mt-1.5 space-y-1.5">
                      <select
                        value={reportReason}
                        onChange={(event) =>
                          setReportReason(event.target.value as (typeof REPORT_REASONS)[number])
                        }
                        className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px] dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
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
                        rows={2}
                        className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px] dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleReport}
                        disabled={reportLoading}
                        className="inline-flex items-center rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {reportLoading ? "접수 중..." : "신고 접수"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 입찰 내역 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                입찰 내역 ({auction._count.bids}건)
              </h3>
              {auction.bids.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {auction.bids.map((bid, i) => (
                    <div
                      key={bid.id}
                      className={cn(
                        "flex items-center justify-between py-2 px-3 rounded-lg",
                        i === 0
                          ? "border border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10"
                          : "bg-gray-50 dark:bg-slate-800/70"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <span className="text-xs font-bold text-primary">
                            {auction.status === "종료" && auction.winnerId === bid.userId
                              ? "낙찰"
                              : "1위"}
                          </span>
                        )}
                        {bid.user?.avatar ? (
                          <Image
                            src={makeImageUrl(bid.user.avatar, "avatar")}
                            className="w-6 h-6 rounded-full object-cover"
                            width={24}
                            height={24}
                            alt=""
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-slate-700" />
                        )}
                        <span className="text-sm text-gray-700 dark:text-slate-200">{bid.user?.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {bid.amount.toLocaleString()}원
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {getTimeAgoString(new Date(bid.createdAt))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-gray-400 dark:text-slate-500">
                  아직 입찰 내역이 없습니다
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 입찰 영역 (진행중일 때만, 본인 경매 아닐 때) */}
      {hasBottomBidLayer && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-10">
          <div className="max-w-xl mx-auto px-4 py-3">
            <div className="mb-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
              <label className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <input
                  type="checkbox"
                  checked={agreedBidRule}
                  onChange={(event) => setAgreedBidRule(event.target.checked)}
                  className="mt-0.5"
                />
                <span>입찰 취소 불가, 마감 임박 자동연장 규칙을 확인했습니다.</span>
              </label>
              <label className="mt-1 flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <input
                  type="checkbox"
                  checked={agreedDisputePolicy}
                  onChange={(event) => setAgreedDisputePolicy(event.target.checked)}
                  className="mt-0.5"
                />
                <span>분쟁 책임 제한 및 신고 접수 정책을 확인했습니다.</span>
              </label>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => increaseBidAmount(bidIncrement)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  +1틱
                </button>
                <button
                  onClick={() => increaseBidAmount(bidIncrement * 2)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  +2틱
                </button>
                <button
                  onClick={() => increaseBidAmount(10_000)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  +10,000원
                </button>
                <button
                  onClick={() => increaseBidAmount(50_000)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  +50,000원
                </button>
                <button
                  onClick={() => increaseBidAmount(100_000)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  +100,000원
                </button>
                <button
                  onClick={() => setBidAmount(minimumBid)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  최소가
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-right dark:bg-slate-800">
                  <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">선택 입찰가</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                    {selectedBidAmount.toLocaleString()}원
                  </p>
                </div>
                <button
                  onClick={handleBid}
                  disabled={
                    bidLoading || !agreedBidRule || !agreedDisputePolicy || isTopBidder
                  }
                  className="flex-shrink-0 px-5 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {bidLoading ? "..." : "입찰"}
                </button>
              </div>
            </div>
            {isTopBidder ? (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                현재 최고 입찰자는 다시 입찰할 수 없습니다. 다른 참여자의 입찰을 기다려주세요.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AuctionDetailClient;
