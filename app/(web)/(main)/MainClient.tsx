"use client";

import { useEffect, useState } from "react";

import FloatingButton from "@components/atoms/floating-button";
import Item from "@components/features/item/item";
import useSWRInfinite from "swr/infinite";

import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { Product } from "@prisma/client";

import SkeletonItem from "@components/atoms/SkeletonItem";
import ItemWrapper from "@components/features/item/ItemWrapper";
import { cn } from "@libs/client/utils";
import { CATEGORIES } from "@libs/constants";

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
}

/** 탭 목록: "전체" + 카테고리 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...CATEGORIES];

const MainClient = () => {
  const [selectedCategory, setSelectedCategory] = useState("전체");

  const getKey = (
    pageIndex: number,
    previousPageData: ProductsResponse | null
  ) => {
    if (previousPageData && !previousPageData.products.length) return null;
    const categoryParam =
      selectedCategory !== "전체" ? `&category=${selectedCategory}` : "";
    return `/api/products?page=${pageIndex + 1}${categoryParam}`;
  };

  const { data, setSize, size, mutate } =
    useSWRInfinite<ProductsResponse>(getKey);
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  // 카테고리 변경 시 목록 초기화
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  // 카테고리 변경 시 데이터 리셋
  useEffect(() => {
    mutate();
  }, [selectedCategory]);

  return (
    <div className="flex flex-col h-full">
      {/* 카테고리 탭 */}
      <div className="sticky top-14 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleCategoryChange(tab.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                selectedCategory === tab.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="flex flex-col my-4 space-y-5 h-full">
        {data ? (
          data.map((result) => {
            return result?.products?.map((product) => (
              <ItemWrapper key={product?.id}>
                <Item
                  id={product?.id}
                  title={product?.name}
                  price={product?.price}
                  hearts={product?._count?.favs}
                  image={product?.photos[0]}
                  createdAt={product.createdAt}
                  category={product?.category}
                  status={product?.status}
                />
              </ItemWrapper>
            ));
          })
        ) : (
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        )}

        {/* 결과 없을 때 */}
        {data &&
          data.length > 0 &&
          data[0].products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-lg font-medium">등록된 상품이 없습니다</p>
              <p className="text-sm mt-1">
                첫 번째 상품을 등록해 보세요!
              </p>
            </div>
          )}
      </div>

      <FloatingButton href="/products/upload">
        <svg
          className="w-6 h-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      </FloatingButton>
    </div>
  );
};
export default MainClient;
