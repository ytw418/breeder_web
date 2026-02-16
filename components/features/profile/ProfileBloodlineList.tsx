"use client";

import Link from "next/link";
import Image from "@components/atoms/Image";
import { Spinner } from "@components/atoms/Spinner";
import { makeImageUrl } from "@libs/client/utils";
import useSWR from "swr";
import { UserBloodlineCardsResponse } from "pages/api/users/[id]/bloodline-cards";

const getCardTypeLabel = (cardType: "BLOODLINE" | "LINE") =>
  cardType === "BLOODLINE" ? "혈통" : "라인";

const getCardStatusLabel = (
  status: "ACTIVE" | "INACTIVE" | "REVOKED" | string
) => {
  if (status === "ACTIVE") return "활성";
  if (status === "INACTIVE") return "비활성";
  if (status === "REVOKED") return "해지";
  return "상태";
};

const getCardStatusClass = (
  status: "ACTIVE" | "INACTIVE" | "REVOKED" | string
) => {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "INACTIVE") return "bg-amber-100 text-amber-700";
  if (status === "REVOKED") return "bg-rose-100 text-rose-600";
  return "bg-slate-100 text-slate-700";
};

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
    <div className="grid grid-cols-2 gap-2">
      {data.cards.map((card) => (
        <Link
          key={card.id}
          href={`/bloodline-management/card/${card.id}`}
          className="app-card app-card-interactive flex min-w-0"
        >
          <div className="flex items-stretch gap-3 p-3.5">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200/70 bg-slate-100">
              {card.image ? (
                <Image
                  src={makeImageUrl(card.image, "product")}
                  className="h-full w-full object-cover transition-transform duration-200"
                  width={64}
                  height={64}
                  alt={card.name}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] font-black tracking-[0.18em] text-slate-500 flex items-center justify-center">
                  BLOODLINE
                </div>
              )}
              <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                {getCardTypeLabel(card.cardType)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <h3
                  className="app-title-md line-clamp-1 leading-snug text-slate-900"
                  title={card.name}
                >
                  {card.name}
                </h3>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCardStatusClass(
                    card.status
                  )}`}
                >
                  {getCardStatusLabel(card.status)}
                </span>
              </div>

              <p className="app-body-sm mt-1 line-clamp-2 leading-relaxed">
                {card.description ||
                  `${card.speciesType ? `${card.speciesType} · ` : ""}BC-${String(
                    card.id
                  ).padStart(6, "0")}`}
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="app-pill-muted">소유 {card.currentOwner.name}</span>
                {card.issueCount > 0 ? (
                  <span className="app-pill-muted">발급 {card.issueCount}회</span>
                ) : null}
                <span className="app-pill-muted">이전 {card.transfers.length}회</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ProfileBloodlineList;
