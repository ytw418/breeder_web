"use client";

import Link from "next/link";
import Image from "@components/atoms/Image";
import { Spinner } from "@components/atoms/Spinner";
import { makeImageUrl } from "@libs/client/utils";
import useSWR from "swr";
import { UserBloodlineCardsResponse } from "pages/api/users/[id]/bloodline-cards";

const getCardTypeLabel = (cardType: "BLOODLINE" | "LINE") =>
  cardType === "BLOODLINE" ? "혈통" : "라인";

const ProfileBloodlineList = ({ userId }: { userId?: number }) => {
  const { data, isLoading } = useSWR<UserBloodlineCardsResponse>(
    userId ? `/api/users/${userId}/bloodline-cards` : null
  );

  if (!userId || isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data?.cards?.length) {
    return (
      <div className="app-card flex h-36 flex-col items-center justify-center text-slate-500">
        <p className="app-title-md text-slate-600">등록한 혈통 카드가 없습니다</p>
        <p className="app-caption mt-1">이 유저가 만든 혈통/라인 카드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {data.cards.map((card) => (
        <Link
          key={card.id}
          href={`/bloodline-management/card/${card.id}`}
          className="app-card app-card-interactive block px-3.5 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {card.image ? (
                <Image
                  src={makeImageUrl(card.image, "product")}
                  className="h-full w-full object-cover"
                  width={64}
                  height={64}
                  alt={card.name}
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="app-pill-accent">{getCardTypeLabel(card.cardType)}</span>
                <span className="app-caption">현재주인 {card.currentOwner.name}</span>
              </div>

              <h3 className="app-title-md line-clamp-1 leading-snug">{card.name}</h3>

              <p className="app-body-sm mt-1 line-clamp-2 leading-relaxed">
                {card.description || `${card.speciesType ? `${card.speciesType} | ` : ""}BC-${String(
                  card.id
                ).padStart(6, "0")}`}
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span>{card.status}</span>
                <span className="text-slate-300">·</span>
                <span>이전 이력 {card.transfers.length}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ProfileBloodlineList;
