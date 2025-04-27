"use client";

import LogRocket from "logrocket";
import { useEffect } from "react";

import FloatingButton from "@components/atoms/floating-button";
import Item from "@components/features/item/item";
import useSWRInfinite from "swr/infinite";

import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { Product } from "@prisma/client";

import SkeletonItem from "@components/atoms/SkeletonItem";
import ItemWrapper from "@components/features/item/ItemWrapper";
LogRocket.init("xwhowu/breeder");

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
}

const getKey = (pageIndex: number, previousPageData: ProductsResponse) => {
  if (previousPageData && !previousPageData.products.length) return null;

  return `/api/products?page=${pageIndex + 1}`;
};

const MainClient = () => {
  // useSWRInfinite 사용법
  // https://swr.vercel.app/ko/docs/pagination#useswrinfinite
  const { data, setSize, size } = useSWRInfinite<ProductsResponse>(getKey);
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  return (
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
