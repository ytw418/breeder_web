"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { setPendingAction } from "@libs/client/pendingAction";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import { fosterPeriodLabel, fosterSupportLabel, parsePetInfo, petPostPlace } from "@libs/shared/petSpace";
import useBlocks from "hooks/useBlocks";
import useUser from "hooks/useUser";

export const FOSTER_RAIL_LIMIT = 10;

/** 손 든 모양(시안 pet-space i-hand). */
function HandIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L4 14a1.5 1.5 0 0 1 2.5-1.6L8 14" />
    </svg>
  );
}

/**
 * 입양 쪽 맨 위 '임보해 주실 분 찾아요' 가로 레일(앱 docs/prd/pet-space.md §5.4, 시안 pet-space/A-karrot.html ③).
 * 분양중인 임보 구해요 글 최신 10개, 카드 148(사진 r8 + 왼쪽 위 기간 딱지 · 제목 14/600 · 동네(시·군·구, §5.9)·지원 12 muted ·
 * '임보 문의하기' 32 버튼). 버튼은 그 글을 열고 바로 채팅을 잇는다(상세의 채팅하기와 같은 흐름 — 로그인·차단 처리를 같이 쓴다).
 * 문구는 '임보 할게요'에서 바꿨다(2026-10-23 코덱스 디자인 리뷰 결정 B — 누르면 대화가 열리는데 신청·수락처럼 읽혔다).
 * 0개거나 조회 오류면 섹션을 그리지 않는다(아래 8 갭까지). '전체 ›'는 입양 쪽 '임보 구해요' 칩.
 */
export default function FosterRail({
  categoryPath,
  onShowAll,
}: {
  /** 강아지·고양이 범위(adoptionScopePaths 를 쉼표로). */
  categoryPath: string;
  onShowAll: () => void;
}) {
  const router = useRouter();
  const { user } = useUser();
  const { blockedIds } = useBlocks();
  const search = new URLSearchParams({
    page: "1",
    size: String(FOSTER_RAIL_LIMIT),
    dealType: "foster",
    status: "판매중",
    categoryPath,
  });
  const { data, error } = useSWR<ProductsResponse>(`/api/products?${search.toString()}`, {
    revalidateOnFocus: false,
  });
  if (error && !data) return null;
  const items = withoutBlocked(data?.products ?? [], blockedIds, (product) => product.userId);
  const loading = !data;
  if (!loading && items.length === 0) return null;

  const raiseHand = (product: { id: number; name: string }) => {
    const path = getProductPath(product.id, product.name);
    trackEvent(ANALYTICS_EVENTS.fosterRaiseHand, { product_id: product.id, source: "rail" });
    // 로그인했으면 상세에 들어가자마자 채팅을 연다(상세 usePendingAction). 아니면 상세의 '임보 문의하기'가 로그인을 묻는다.
    if (user) setPendingAction({ kind: "chat", targetId: product.id, returnPath: path });
    router.push(path);
  };

  return (
    <section className="pt-4" aria-label="임보해 주실 분 찾아요" data-testid="foster-rail">
      <div className="mb-3 flex items-end justify-between px-4">
        <h2 className="text-[16px] font-bold leading-[22px] text-app-text">임보해 주실 분 찾아요</h2>
        {items.length > 0 ? (
          <button type="button" onClick={onShowAll} className="text-[13px] text-app-muted">
            전체 ›
          </button>
        ) : null}
      </div>
      {/* pb-1.5: 버튼 아래로 늘린 터치 칸이 가로 스크롤 영역 밖으로 나가 세로 스크롤이 생기지 않게 둔다. */}
      <HorizontalRail label="임보 구해요 목록" className="gap-2 px-4 pb-1.5">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="w-[148px] shrink-0" aria-hidden="true">
                <div className="h-[148px] w-[148px] animate-pulse rounded-lg bg-app-placeholder" />
                <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
                <div className="mt-2 h-8 w-full animate-pulse rounded-lg bg-app-placeholder" />
              </div>
            ))
          : items.map((item) => {
              const info = parsePetInfo(item.petInfo);
              const period = fosterPeriodLabel(info);
              const meta = [petPostPlace(item), fosterSupportLabel(info)].filter(Boolean).join(" · ");
              const mine = Boolean(user?.id && user.id === item.userId);
              return (
                <div key={item.id} className="w-[148px] shrink-0">
                  <Link href={getProductPath(item.id, item.name)} className="block">
                    <span className="relative block h-[148px] w-[148px] overflow-hidden rounded-lg bg-app-placeholder">
                      {item.photos?.[0] ? (
                        <Image
                          src={makeImageUrl(item.photos[0], "product")}
                          alt={item.name}
                          width={148}
                          height={148}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // 사진 없는 글은 가운데 그림 아이콘(앱 FosterCard·ProductCard 와 같다).
                        <span className="grid h-full w-full place-items-center text-app-caption" aria-hidden="true">
                          <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </span>
                      )}
                      {period ? (
                        <span className="absolute left-1.5 top-1.5 h-5 max-w-[136px] truncate rounded bg-app-inverse px-1.5 text-[12px] font-semibold leading-5 text-app-inverse-text">
                          {period}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block truncate text-[15px] font-semibold leading-5 text-app-text">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] leading-4 text-app-muted">
                      {meta || item.user?.name || "임보 구해요"}
                    </span>
                  </Link>
                  {mine ? null : (
                    <button
                      type="button"
                      aria-label={`${item.name}, 임보 문의하기`}
                      onClick={() => raiseHand(item)}
                      // 보이는 32 + 위아래 6 = 터치 44(2026-10-23 코덱스 디자인 리뷰). 넓은 면이라 brand-surface(다크 회색, 앱과 같다).
                      className="relative mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-app-brand-surface text-[13px] font-semibold text-app-brand-text after:absolute after:inset-x-0 after:-inset-y-1.5"
                    >
                      <HandIcon />
                      임보 문의하기
                    </button>
                  )}
                </div>
              );
            })}
      </HorizontalRail>
      {/* 아래 '가족을 기다려요'와 가르는 8 갭. 레일이 숨으면 같이 숨는다(칩 바로 아래 빈 띠가 남지 않게). */}
      <div className="mt-3.5 h-2 bg-app-gap" aria-hidden="true" />
    </section>
  );
}
