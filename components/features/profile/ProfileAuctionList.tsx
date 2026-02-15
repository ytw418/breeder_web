"use client";

import Link from "next/link";
import Image from "@components/atoms/Image";
import { Spinner } from "@components/atoms/Spinner";
import { makeImageUrl } from "@libs/client/utils";
import useSWR from "swr";
import { UserAuctionsResponse } from "pages/api/users/[id]/auctions";
import { getTimeAgoString } from "@libs/client/utils";

type AuctionStatus = UserAuctionsResponse["auctions"][number]["status"];

const getAuctionStatusBadgeClass = (status: AuctionStatus) => {
  if (status === "진행중") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "종료") {
    return "bg-slate-700 text-white";
  }
  if (status === "취소") {
    return "bg-red-100 text-red-700";
  }
  return "bg-slate-100 text-slate-700";
};

const ProfileAuctionList = ({ userId }: { userId?: number }) => {
  const { data, isLoading } = useSWR<UserAuctionsResponse>(
    userId ? `/api/users/${userId}/auctions` : null
  );

  if (!userId || isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data?.auctions?.length) {
    return (
      <div className="app-card flex h-36 flex-col items-center justify-center text-slate-500">
        <p className="app-title-md text-slate-600">등록한 경매가 없습니다</p>
        <p className="app-caption mt-1">이 유저의 경매 등록 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {data.auctions.map((auction) => (
        <Link
          key={auction.id}
          href={`/auctions/${auction.id}`}
          className="app-card app-card-interactive block px-3.5 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className={`app-pill-muted ${getAuctionStatusBadgeClass(
                    auction.status
                  )}`}
                >
                  {auction.status}
                </span>
                <span className="app-caption">{auction.category || "경매"}</span>
                <span className="app-caption">{getTimeAgoString(new Date(auction.createdAt))}</span>
              </div>

              <h3 className="app-title-md line-clamp-1 leading-snug">
                {auction.title}
              </h3>

              <p className="app-body-sm mt-1 line-clamp-2 leading-relaxed">
                {auction.description}
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span>현재가 {auction.currentPrice.toLocaleString()}원</span>
                <span className="text-slate-300">·</span>
                <span>입찰 {auction._count.bids}</span>
              </div>
            </div>

            {auction.photos?.[0] ? (
              <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={makeImageUrl(auction.photos[0], "public")}
                  className="h-full w-full object-cover"
                  width={72}
                  height={72}
                  alt={auction.title}
                />
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ProfileAuctionList;
