"use client";

import Link from "next/link";

import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { shelterCardMeta, shelterCardTitle } from "@libs/shared/shelterCard";
import { shelterNoticeLabel } from "@libs/shared/shelterNotice";

export type ShelterAnimal = {
  id: number;
  name: string;
  category?: string | null;
  description?: string | null;
  photos?: string[] | null;
  petInfo?: unknown;
  regionSido?: string | null;
  regionSigungu?: string | null;
  externalBreed?: string | null;
  externalWeightKg?: number | null;
  externalNoticeEnd?: string | Date | null;
};

/**
 * 보호소 아이들 2열 카드(앱 design/mockups/adoption-v2/A-karrot.html .gc): 정사각 사진 r8,
 * 왼쪽 위 '보호소' 흰 딱지(11/600), 왼쪽 아래 '공고 D-10' 검정 딱지, 제목 15/600 '말티즈 여아', 둘째 줄 13 muted '수원 · 2021년생 · 3.2kg'.
 * 공고 D-n 은 공고 마감 칸(externalNoticeEnd)에서 세고, 칸이 비었으면 본문 줄에서 센다. 이미 지났으면 딱지를 그리지 않는다.
 */
export default function ShelterAnimalCard({ animal, priority = false }: { animal: ShelterAnimal; priority?: boolean }) {
  const meta = shelterCardMeta(animal);
  const notice = shelterNoticeLabel(animal);
  const photo = animal.photos?.[0];
  return (
    <li className="min-w-0">
      <Link href={getProductPath(animal.id, animal.name)} className="block" data-testid="shelter-card">
        <span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-app-placeholder">
          {photo ? (
            <Image
              src={makeImageUrl(photo, "product")}
              alt={animal.name}
              width={240}
              height={240}
              priority={priority}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-app-caption" aria-hidden="true">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </span>
          )}
          <span className="absolute left-1.5 top-1.5 h-5 rounded bg-app-elevated px-1.5 text-[11px] font-semibold leading-5 text-app-text">
            보호소
          </span>
          {notice ? (
            <span className="absolute bottom-1.5 left-1.5 h-5 rounded bg-app-text px-1.5 text-[11px] font-semibold leading-5 text-app-bg">
              {notice}
            </span>
          ) : null}
        </span>
        <span className="mt-2 block truncate text-[15px] font-semibold leading-5 text-app-text">
          {shelterCardTitle(animal)}
        </span>
        {meta ? (
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-app-muted">{meta}</span>
        ) : null}
      </Link>
    </li>
  );
}
