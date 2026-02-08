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

  // 경매 데이터 (5초 간격 새로고침)
  const { data, mutate: boundMutate } = useSWR<AuctionDetailResponse>(
    params?.id ? `/api/auctions/${params.id}` : null,
    { refreshInterval: 5000 }
  );

  // 입찰 API
  const [submitBid, { loading: bidLoading }] = useMutation(
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
  const minimumBid = auction ? auction.currentPrice + auction.minBidIncrement : 0;

  /** 입찰 핸들러 */
  const handleBid = () => {
    if (!user) return router.push("/auth/login");
    if (bidLoading) return;

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
          setBidAmount("");
          boundMutate();
        } else {
          toast.error(result.error || "입찰에 실패했습니다.");
        }
      },
      onError() {
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  /** 빠른 입찰 (최소 입찰가로 자동 설정) */
  const handleQuickBid = () => {
    setBidAmount(String(minimumBid));
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
                    imageIndex === i ? "bg-white" : "bg-white/50"
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
            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
              {auction.description}
            </p>
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

            {/* 입찰 내역 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
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
                <p className="text-sm text-gray-400 text-center py-4">
                  아직 입찰 내역이 없습니다
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 입찰 영역 (진행중일 때만, 본인 경매 아닐 때) */}
      {auction.status === "진행중" && !data?.isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
          <div className="max-w-xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleQuickBid}
                className="flex-shrink-0 px-3 py-2.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                최소 {minimumBid.toLocaleString()}원
              </button>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`${minimumBid.toLocaleString()}원 이상`}
                className="flex-1 bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleBid}
                disabled={bidLoading}
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
