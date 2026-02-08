"use client";
import Item from "../item/item";
import useSWR from "swr";
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
  const { data, isLoading } = useSWR<MySellHistoryResponseType>(
    `/api/users/${id}/${kind}`
  );

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
              />
            </ItemWrapper>
          ))}
        </div>
      ) : (
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
      )}
    </MainLayout>
  );
}
