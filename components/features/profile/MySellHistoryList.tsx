"use client";
import Item from "../item";
import useSWR from "swr";
import MainLayout from "@components/features/layout";
import SkeletonItem from "@components/atoms/SkeletonItem";

interface ProductListProps {
  kind: "favs" | "sales" | "purchases";
  id: number;
}

interface Record {
  id: number;
  product: any;
}

interface ProductListResponse {
  [key: string]: Record[];
}

export default function MySellHistoryList({ kind, id }: ProductListProps) {
  const { data, isLoading } = useSWR<ProductListResponse>(
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
      {data[kind]?.map((record) => (
        <Item
          id={record.product.id}
          key={record.id}
          title={record.product.name}
          price={record.product.price}
          hearts={record.product._count.favs}
          image={record.product?.image}
          createdAt={record.product?.createdAt}
        />
      ))}
    </MainLayout>
  ) : null;
}
