"use client";
import Item from "../item/item";
import useSWR from "swr";
import Link from "next/link";
import MainLayout from "@components/features/MainLayout";
import SkeletonItem from "@components/atoms/SkeletonItem";
import ItemWrapper from "../item/ItemWrapper";
import { MySellHistoryResponseType } from "pages/api/users/[id]/sales";

interface ProductListProps {
  kind: "favs" | "sales" | "purchases";
  id: number;
}

const titleMap = {
  favs: "관심목록",
  sales: "판매내역",
  purchases: "구매내역",
};

const emptyMessageMap = {
  favs: "아직 관심 상품이 없습니다",
  sales: "아직 판매 내역이 없습니다",
  purchases: "아직 구매 내역이 없습니다",
};

const emptyDescMap = {
  favs: "마음에 드는 상품에 하트를 눌러보세요",
  sales: "상품을 판매완료 처리하면 여기에 기록됩니다",
  purchases: "상품을 구매확정하면 여기에 기록됩니다",
};

export default function MySellHistoryList({ kind, id }: ProductListProps) {
  const { data, error, isLoading, mutate } = useSWR<MySellHistoryResponseType>(
    `/api/users/${id}/${kind}`
  );
  const errorStatus = (error as (Error & { status?: number }) | undefined)
    ?.status;

  if (isLoading) {
    return (
      <MainLayout hasTabBar canGoBack title={titleMap[kind]}>
        <div className="space-y-5 py-4">
          {[...Array(5)].map((_, i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      </MainLayout>
    );
  }

  // 401·403·오류를 '내역 없음'으로 보이지 않게 먼저 거른다.
  // 빈 상태는 성공 응답이 비어 있을 때만 그린다.
  if (errorStatus === 401 || errorStatus === 403 || (error && !data)) {
    return (
      <MainLayout hasTabBar canGoBack title={titleMap[kind]}>
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
          {errorStatus === 401 ? (
            <>
              <p className="text-lg font-medium">로그인이 필요합니다</p>
              <p className="text-sm mt-1">
                {titleMap[kind]}을 보려면 로그인해 주세요.
              </p>
              <Link
                href={`/auth/login?next=${encodeURIComponent(
                  `/profiles/${id}/${kind}`
                )}`}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                로그인하기
              </Link>
            </>
          ) : errorStatus === 403 ? (
            <p className="text-lg font-medium">
              {error?.message || `본인의 ${titleMap[kind]}만 볼 수 있습니다.`}
            </p>
          ) : (
            <>
              <p className="text-lg font-medium">
                {titleMap[kind]}을 불러오지 못했습니다
              </p>
              <p className="text-sm mt-1">잠시 후 다시 시도해주세요.</p>
              <button
                type="button"
                onClick={() => mutate()}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                다시 불러오기
              </button>
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout hasTabBar canGoBack title={titleMap[kind]}>
      {data?.mySellHistoryData && data.mySellHistoryData.length > 0 ? (
        <div className="space-y-5 py-4">
          {data.mySellHistoryData.map((record) => (
            <ItemWrapper key={record.id}>
              <Item
                id={record.product.id}
                title={record.product.name}
                price={record.product.price}
                hearts={record.product._count.favs}
                image={record.product?.photos?.[0]}
                createdAt={record.product?.createdAt}
                removed={record.product.isDeleted || record.product.isHidden}
              />
            </ItemWrapper>
          ))}
        </div>
      ) : data ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg
            className="w-16 h-16 text-gray-200 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {kind === "favs" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            )}
          </svg>
          <p className="text-lg font-medium">{emptyMessageMap[kind]}</p>
          <p className="text-sm mt-1">{emptyDescMap[kind]}</p>
        </div>
      ) : null}
    </MainLayout>
  );
}
