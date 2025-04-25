"use client";
import Link from "next/link";
import React from "react";
import { useParams } from "next/navigation";
import useUser from "@libs/client/useUser";
import useSWR from "swr";
import { Card } from "@components/ui/card";
import { Spinner } from "@components/atoms/Spinner";
import { Button } from "@components/ui/button";

interface Product {
  id: number;
  name: string;
  price: number;
  photos: string[];
  _count: {
    favs: number;
  };
}

interface ProductListResponse {
  success: boolean;
  products: Product[];
}

interface MySaleHistroyMenuProps {
  limit?: number;
}

const MySaleHistroyMenu = ({ limit }: MySaleHistroyMenuProps) => {
  const params = useParams();
  const { user } = useUser();
  // 마이페이지면 user.id 다른 유저의 프로필페이지면 params.id
  const id = params?.id ? Number(params?.id) : user?.id;

  // 상품 목록 API 엔드포인트 수정
  const { data, isLoading } = useSWR<ProductListResponse>(
    id ? `/api/users/${id}/products` : null
  );

  return (
    <div className="space-y-4">
      {/* 기존 메뉴 버튼들 */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href={`/profiles/${id}/sales`}
          className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium">판매내역</span>
        </Link>

        <Link
          href={`/profiles/${id}/purchases`}
          className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium">구매내역</span>
        </Link>

        <Link
          href={`/profiles/${id}/favs`}
          className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium">관심목록</span>
        </Link>
      </div>

      {/* 내 상품 목록 */}
      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <Spinner />
        </div>
      ) : !data?.products.length ? (
        <div className="flex justify-center items-center h-32 text-gray-500">
          등록된 상품이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(limit ? data.products.slice(0, limit) : data.products).map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card className="p-4">
                <div className="relative aspect-square rounded-lg overflow-hidden">
                  {product.photos[0] && (
                    <img
                      src={product.photos[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium truncate">{product.name}</h3>
                  <p className="text-sm font-semibold text-primary">
                    {product.price.toLocaleString()}원
                  </p>
                  <div className="flex items-center text-sm text-gray-500">
                    <span>관심 {product._count.favs}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySaleHistroyMenu;
