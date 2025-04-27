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

export default function MySellHistoryList({ kind, id }: ProductListProps) {
  const { data, isLoading } = useSWR<MySellHistoryResponseType>(
    `/api/users/${id}/${kind}`
  );

  const titleMap = {
    favs: "관심목록",
    sales: "판매내역",
    purchases: "구매내역",
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        {[...Array(5)].map((_, i) => (
          <SkeletonItem key={i} />
        ))}
      </div>
    );
  }

  return data ? (
    <MainLayout hasTabBar canGoBack title={`${titleMap[kind]}`}>
      <div className="space-y-5">
        {data.mySellHistoryData?.map((record) => (
          <ItemWrapper key={record.product.id}>
            <Item
              id={record.product.id}
              key={record.id}
              title={record.product.name}
              price={record.product.price}
              hearts={record.product._count.favs}
              image={record.product?.photos[0]}
              createdAt={record.product?.createdAt}
            />
          </ItemWrapper>
        ))}
      </div>
    </MainLayout>
  ) : null;
}
