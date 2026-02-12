"use client";

import { useEffect, useState } from "react";
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
  const [bidAmount, setBidAmount] = useState<number | null>(null);
  const [countdown, setCountdown] = useState({ text: "", isEnded: false });
  const [imageIndex, setImageIndex] = useState(0);
  const [agreedBidRule, setAgreedBidRule] = useState(false);
  const [agreedDisputePolicy, setAgreedDisputePolicy] = useState(false);
  const [reportReason, setReportReason] =
    useState<(typeof REPORT_REASONS)[number]>("허위 매물 의심");
  const [reportDetail, setReportDetail] = useState("");

  // 경매 데이터 (5초 간격 새로고침)
  const { data, mutate: boundMutate } = useSWR<AuctionDetailResponse>(
    params?.id ? `/api/auctions/${params.id}` : null,
    { refreshInterval: 5000 }
  );

  // 입찰 API
  const [submitBid, { loading: bidLoading }] = useMutation<BidResponse>(
    params?.id ? `/api/auctions/${params.id}/bid` : ""
  );
  const [submitReport, { loading: reportLoading }] =
    useMutation<AuctionReportResponse>(
      params?.id ? `/api/auctions/${params.id}/report` : ""
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
      return normalizeBidAmount(baseAmount + delta);
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
    if (!user) return router.push(`/auth/login?next=${encodeURIComponent(pathname || "/")}`);
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
          toast.success("입찰이 완료되었습니다!");
          if (result.extended) {
            toast.info(`마감 임박 입찰로 경매 시간이 ${extensionMinutes}분 연장되었습니다.`);
          }
          setBidAmount(null);
          boundMutate();
        } else {
          toast.error(getAuctionErrorMessage(result.errorCode, result.error || "입찰에 실패했습니다."));
        }
      },
      onError() {
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  const getAuctionUrl = () => {
    if (typeof window === "undefined") return "";
    return window.location.href;
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
          title: auction?.title || "브리디 경매",
          text: "브리디 경매를 확인해보세요.",
          url,
        });
        toast.success("공유를 완료했습니다.");
        return;
      }

      await copyToClipboard(url);
      toast.info("이 기기에서는 바로 공유를 지원하지 않아 링크를 복사했습니다.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("공유에 실패했습니다.");
    }
  };

  const handleReport = () => {
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(pathname || "/")}`);
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
          toast.error(getAuctionErrorMessage(result.errorCode, result.error || "신고 접수에 실패했습니다."));
          return;
        }
        toast.success("신고가 접수되었습니다. 운영자가 검토 후 조치합니다.");
        setReportDetail("");
      },
      onError() {
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
      <div className="pb-24">
        {/* 이미지 슬라이더 */}
        <div className="relative aspect-[4/3] bg-gray-100">
          {auction.photos?.[imageIndex] ? (
            <Image
              src={makeImageUrl(auction.photos[imageIndex], "public")}
              className="object-cover"
              alt={auction.title}
              fill
              sizes="600px"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
          {auction.photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {auction.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    imageIndex === i ? "bg-white dark:bg-white" : "bg-white/50 dark:bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4">
          {/* 카운트다운 배너 */}
          <div
            className={cn(
              "mt-4 py-3 px-4 rounded-xl text-center font-bold",
              countdown.isEnded || auction.status !== "진행중"
                ? "bg-gray-100 text-gray-500"
                : "bg-red-50 text-red-600"
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
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3">
              <p className="text-sm font-bold text-rose-800">신고/운영 처리로 경매 중단</p>
              <p className="mt-1 text-xs leading-relaxed text-rose-900">
                이 경매는 운영 정책에 따라 취소되었습니다. 추가 이의가 있으면 신고 접수 채널로 문의해 주세요.
              </p>
            </div>
          )}

          {auction.status === "종료" && winnerBid && (
            <div
              className={cn(
                "mt-3 rounded-xl border px-3.5 py-3",
                isWinner
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-blue-200 bg-blue-50"
              )}
            >
              <p
                className={cn(
                  "text-sm font-bold",
                  isWinner ? "text-emerald-800" : "text-blue-800"
                )}
              >
                {isWinner ? "낙찰 완료: 축하합니다!" : "낙찰 결과"}
              </p>
              <div className="mt-1.5 space-y-1 text-xs text-slate-700">
                <p>낙찰자: {winnerBid.user?.name}</p>
                <p>낙찰가: {winnerBid.amount.toLocaleString()}원</p>
                <p>종료시각: {new Date(auction.endAt).toLocaleString()}</p>
              </div>
              <div className="mt-2 rounded-lg border border-white/80 bg-white/80 px-2.5 py-2 text-[11px] text-slate-700">
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
          <Link
            href={`/profiles/${auction.user?.id}`}
            className="flex items-center gap-3 py-4 border-b border-gray-100"
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
              <div className="w-10 h-10 rounded-full bg-gray-200" />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{auction.user?.name}</p>
              <p className="text-xs text-gray-400">경매 등록자</p>
            </div>
          </Link>

          {/* 상품 정보 */}
          <div className="py-4 space-y-3 border-b border-gray-100">
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
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {auction.status}
              </span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{auction.title}</h1>
            <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {auction.description}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {data?.isOwner && data?.canEdit && !isToolRoute ? (
                <Link
                  href={`/auctions/${auction.id}/edit`}
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
              <p className="text-xs text-slate-500">
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-xs font-semibold text-slate-700">판매자 신뢰 정보</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
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
                    <p className="whitespace-pre-line">추가 안내: {auction.sellerTrustNote}</p>
                  ) : null}
                </div>
                {auction.sellerProofImage ? (
                  <div className="relative mt-2 h-28 w-40 overflow-hidden rounded-md border border-slate-200">
                    <Image
                      src={makeImageUrl(auction.sellerProofImage, "public")}
                      className="object-cover"
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
                <p className="text-xs text-gray-400">시작가</p>
                <p className="text-sm text-gray-500">{auction.startPrice.toLocaleString()}원</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">현재 최고가</p>
                <p className="text-2xl font-bold text-primary">
                  {auction.currentPrice.toLocaleString()}원
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">경매 규칙</p>
                <Link
                  href="/auctions/rules"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 underline underline-offset-2"
                >
                  전체 보기
                </Link>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>• 현재가 기준 입찰 단위: {getBidIncrement(auction.currentPrice).toLocaleString()}원</li>
                <li>• 마감 {extensionWindowMinutes}분 이내 입찰 시 종료 시간이 {extensionMinutes}분 연장됩니다.</li>
                <li>• 입찰은 취소할 수 없으며, 본인 경매 입찰은 불가합니다.</li>
                <li>• 현재 최고 입찰자는 재입찰할 수 없습니다.</li>
              </ul>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <p className="font-semibold">분쟁/신고 안내</p>
                <p className="mt-1 leading-relaxed">
                  본 서비스는 거래 당사자 간 분쟁에 대해 법적 책임을 지지 않습니다.
                  다만 문제가 발생하면 신고를 접수하여 운영정책에 따라 검토 및 제재를 진행합니다.
                </p>
                <p className="mt-1 leading-relaxed font-semibold">
                  카카오 로그인 기반 계정은 위반 시 영구 참여 제한됩니다.
                </p>
                <a
                  href="mailto:support@bredy.app?subject=[경매%20신고]%20분쟁%20접수"
                  className="mt-1.5 inline-flex items-center font-semibold underline underline-offset-2"
                >
                  신고 접수: support@bredy.app
                </a>
                {!data?.isOwner && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-2.5">
                    <p className="text-[11px] font-semibold text-amber-900">빠른 신고 접수</p>
                    <div className="mt-1.5 space-y-1.5">
                      <select
                        value={reportReason}
                        onChange={(event) =>
                          setReportReason(event.target.value as (typeof REPORT_REASONS)[number])
                        }
                        className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px]"
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
                        className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px]"
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
                        i === 0 ? "bg-primary/5 border border-primary/20" : "bg-gray-50"
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
                          <div className="w-6 h-6 rounded-full bg-gray-200" />
                        )}
                        <span className="text-sm text-gray-700">{bid.user?.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {bid.amount.toLocaleString()}원
                        </p>
                        <p className="text-xs text-gray-400">
                          {getTimeAgoString(new Date(bid.createdAt))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
                  아직 입찰 내역이 없습니다
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 입찰 영역 (진행중일 때만, 본인 경매 아닐 때) */}
      {auction.status === "진행중" && !data?.isOwner && (
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
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +1틱
                </button>
                <button
                  onClick={() => increaseBidAmount(bidIncrement * 2)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +2틱
                </button>
                <button
                  onClick={() => increaseBidAmount(10_000)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +10,000원
                </button>
                <button
                  onClick={() => increaseBidAmount(50_000)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +50,000원
                </button>
                <button
                  onClick={() => increaseBidAmount(100_000)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +100,000원
                </button>
                <button
                  onClick={() => setBidAmount(minimumBid)}
                  disabled={isTopBidder}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  최소가
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-right">
                  <p className="text-[10px] font-medium text-gray-500">선택 입찰가</p>
                  <p className="text-sm font-bold text-gray-900">
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
              <p className="mt-2 text-[11px] text-amber-700">
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
