"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { cn, makeImageUrl, getTimeAgoString } from "@libs/client/utils";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { AuctionDetailResponse } from "pages/api/auctions/[id]";
import { BidResponse } from "pages/api/auctions/[id]/bid";
import { getBidIncrement } from "@libs/auctionRules";
import { getAuctionErrorMessage } from "@libs/client/auctionErrorMessage";

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
  const { user } = useUser();
  const [bidAmount, setBidAmount] = useState("");
  const [countdown, setCountdown] = useState({ text: "", isEnded: false });
  const [imageIndex, setImageIndex] = useState(0);
  const [agreedBidRule, setAgreedBidRule] = useState(false);
  const [agreedDisputePolicy, setAgreedDisputePolicy] = useState(false);

  // 경매 데이터 (5초 간격 새로고침)
  const { data, mutate: boundMutate } = useSWR<AuctionDetailResponse>(
    params?.id ? `/api/auctions/${params.id}` : null,
    { refreshInterval: 5000 }
  );

  // 입찰 API
  const [submitBid, { loading: bidLoading }] = useMutation<BidResponse>(
    params?.id ? `/api/auctions/${params.id}/bid` : ""
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
  const minimumBid = auction ? auction.currentPrice + getBidIncrement(auction.currentPrice) : 0;
  const secondQuickBid = minimumBid + (auction ? getBidIncrement(minimumBid) : 0);

  /** 입찰 핸들러 */
  const handleBid = () => {
    if (!user) return router.push("/auth/login");
    if (bidLoading) return;
    if (!agreedBidRule || !agreedDisputePolicy) {
      toast.error("입찰 전 주의사항 및 분쟁 정책 동의가 필요합니다.");
      return;
    }

    const amount = Number(bidAmount);
    if (isNaN(amount) || amount < minimumBid) {
      toast.error(`최소 ${minimumBid.toLocaleString()}원 이상 입찰해야 합니다.`);
      return;
    }

    submitBid({
      data: { amount },
      onCompleted(result) {
        if (result.success) {
          toast.success("입찰이 완료되었습니다!");
          if (result.extended) {
            toast.info("마감 임박 입찰로 경매 시간이 3분 연장되었습니다.");
          }
          setBidAmount("");
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

  /** 빠른 입찰 */
  const handleQuickBid = (amount: number) => {
    setBidAmount(String(amount));
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
    <Layout canGoBack title="경매 상세" seoTitle={auction.title}>
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
                {auction.status === "종료" ? "경매가 종료되었습니다" : "유찰되었습니다"}
              </span>
            )}
          </div>

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
            {data?.isOwner ? (
              <div className="pt-1">
                {data?.canEdit ? (
                  <Link
                    href={`/auctions/${auction.id}/edit`}
                    className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    경매 수정하기
                  </Link>
                ) : (
                  <p className="text-xs text-slate-500">
                    경매 등록 후 1시간 이내, 입찰이 없을 때만 수정할 수 있습니다.
                  </p>
                )}
              </div>
            ) : null}
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
                <li>• 마감 3분 이내 입찰 시 종료 시간이 3분 연장됩니다.</li>
                <li>• 입찰은 취소할 수 없으며, 본인 경매 입찰은 불가합니다.</li>
                <li>• 현재 최고 입찰자는 재입찰할 수 없습니다.</li>
                <li>• 가입 후 24시간이 지나야 입찰할 수 있습니다.</li>
              </ul>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <p className="font-semibold">분쟁/신고 안내</p>
                <p className="mt-1 leading-relaxed">
                  본 서비스는 거래 당사자 간 분쟁에 대해 법적 책임을 지지 않습니다.
                  다만 문제가 발생하면 신고를 접수하여 운영정책에 따라 검토 및 제재를 진행합니다.
                </p>
                <a
                  href="mailto:support@bredy.app?subject=[경매%20신고]%20분쟁%20접수"
                  className="mt-1.5 inline-flex items-center font-semibold underline underline-offset-2"
                >
                  신고 접수: support@bredy.app
                </a>
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
                          <span className="text-xs font-bold text-primary">1위</span>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickBid(minimumBid)}
                className="flex-shrink-0 px-3 py-2.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                +1틱
              </button>
              <button
                onClick={() => handleQuickBid(secondQuickBid)}
                className="flex-shrink-0 px-3 py-2.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                +2틱
              </button>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`${minimumBid.toLocaleString()}원 이상`}
                step={getBidIncrement(auction.currentPrice)}
                className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleBid}
                disabled={bidLoading || !agreedBidRule || !agreedDisputePolicy}
                className="flex-shrink-0 px-5 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {bidLoading ? "..." : "입찰"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AuctionDetailClient;
