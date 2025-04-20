import { ProductListResponse } from "pages/api/users/[id]/productList";
import React from "react";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { makeImageUrl } from "@libs/client/utils";

const MyPostList = ({ userId }: { userId: number }) => {
  const { data, isLoading } = useSWR<ProductListResponse>(
    `/api/users/${userId}/productList`
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data?.products.length) {
    return (
      <div className="flex justify-center items-center h-32 text-gray-500">
        등록된 상품이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {data.products.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`}>
          <div className="flex flex-col space-y-2 cursor-pointer">
            <div className="relative aspect-square rounded-lg overflow-hidden">
              <Image
                src={makeImageUrl(product.photos[0], "product")}
                alt={product.name}
                fill
                className="object-cover transition-transform hover:scale-105"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 truncate">
                {product.name}
              </span>
              <span className="text-sm font-semibold text-primary">
                {product.price.toLocaleString()}원
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default MyPostList;
