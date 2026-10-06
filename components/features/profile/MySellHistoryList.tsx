"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import MainLayout from "@components/features/MainLayout";
import { ProductCard } from "@components/app/ProductCard";
import useUser from "hooks/useUser";
import type { MySellHistoryResponseType } from "pages/api/users/[id]/sales";
import { LoadingBlock } from "./ProfileRows";

type HistoryKind = "favs" | "sales" | "purchases";

interface ProductListProps {
  kind: HistoryKind;
  id: number;
}

const TITLE: Record<HistoryKind, string> = {
  favs: "관심목록",
  sales: "판매내역",
  purchases: "구매내역",
};

const EMPTY_MESSAGE: Record<HistoryKind, string> = {
  favs: "아직 관심 상품이 없습니다",
  sales: "아직 판매 내역이 없습니다",
  purchases: "아직 구매 내역이 없습니다",
};

/** 권한 없음(비로그인 401·다른 사용자 403) 안내. 다시 시도해도 같아 재시도 버튼은 두지 않는다. */
const DENIED_MESSAGE: Record<HistoryKind, string> = {
  favs: "관심목록은 본인만 볼 수 있습니다.",
  sales: "판매내역을 볼 수 없습니다.",
  purchases: "구매내역을 볼 수 없습니다.",
};

function CenterMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-[14px] text-app-muted">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 h-9 rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
      >
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * 판매·구매·관심 목록(앱 profiles/[id]/sales·purchases·favs). ProductCard 플랫 행 / 빈 상태 14 muted 가운데.
 * 구매내역은 다른 사용자도 볼 수 있다(관심목록만 본인 전용 — 서버가 401·403 으로 막고 여기서는 안내만 한다).
 * `/profiles/0/...`(비로그인 사이드 메뉴 링크)로 들어오면 로그인한 내 id 경로로 바꾼다.
 */
export default function MySellHistoryList({ kind, id }: ProductListProps) {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const resolvingOwner = id === 0;

  useEffect(() => {
    if (!resolvingOwner || userLoading) return;
    if (user?.id) {
      router.replace(`/profiles/${user.id}/${kind}`);
    } else {
      router.replace(`/auth/login?next=${encodeURIComponent(`/profiles/0/${kind}`)}`);
    }
  }, [kind, resolvingOwner, router, user?.id, userLoading]);

  // 관심목록 권한(본인만)은 서버가 판정한다(비로그인 401 · 다른 사용자 403).
  const { data, error, isLoading, mutate } = useSWR<MySellHistoryResponseType>(
    resolvingOwner ? null : `/api/users/${id}/${kind}`
  );
  const errorStatus = (error as (Error & { status?: number }) | undefined)?.status;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.replace("/");
  };

  let content: ReactNode;
  if (resolvingOwner || isLoading) {
    content = <LoadingBlock height={320} />;
  } else if (!data && errorStatus === 401) {
    content = (
      <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
        <p className="text-[16px] font-semibold text-app-text">로그인이 필요합니다</p>
        <p className="mt-1.5 text-[14px] text-app-muted">{TITLE[kind]}을 보려면 로그인해 주세요.</p>
        <Link
          href={`/auth/login?next=${encodeURIComponent(`/profiles/${id}/${kind}`)}`}
          className="mt-3 inline-flex h-9 items-center rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
        >
          로그인하기
        </Link>
      </div>
    );
  } else if (!data && errorStatus === 403) {
    content = <CenterMessage message={DENIED_MESSAGE[kind]} actionLabel="돌아가기" onAction={goBack} />;
  } else if (error && !data) {
    content = (
      <CenterMessage
        message={`${TITLE[kind]}을 불러올 수 없습니다.`}
        actionLabel="다시 시도"
        onAction={() => void mutate()}
      />
    );
  } else if (!data?.mySellHistoryData?.length) {
    content = (
      <div className="flex items-center justify-center px-5 py-20 text-center">
        <p className="text-[14px] text-app-muted">{EMPTY_MESSAGE[kind]}</p>
      </div>
    );
  } else {
    content = (
      <div>
        {data.mySellHistoryData.map((record) => {
          const product = record.product as typeof record.product & {
            category?: string | null;
            status?: string | null;
          };
          return (
            <ProductCard
              key={record.id}
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.photos?.[0] ?? null,
                createdAt: product.createdAt,
                category: product.category ?? null,
                status: product.status ?? null,
                isDeleted: product.isDeleted,
                isHidden: product.isHidden,
                wishCount: product._count?.favs ?? 0,
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <MainLayout canGoBack title={TITLE[kind]} seoTitle={TITLE[kind]}>
      {content}
    </MainLayout>
  );
}
