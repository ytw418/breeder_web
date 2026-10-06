"use client";

import { ProductCard } from "@components/app/ProductCard";

interface ItemProps {
  title: string;
  id: number;
  price: number | null;
  /** 호환용(행에는 관심 수만 보인다). */
  comments?: number;
  hearts: number;
  image: string;
  createdAt: Date | string;
  category?: string | null;
  status?: string | null;
  /** 호환용. 모든 호출부가 같은 당근 톤 행(ProductCard)으로 그려진다. */
  minimal?: boolean;
  /** 삭제·숨김 상품(판매·구매내역 기록). 상세가 404 라 링크 없이 '삭제된 상품'으로 보인다. */
  removed?: boolean;
}

/** 기존 상품 행 호출부용 어댑터. 실제 모양은 components/app/ProductCard. */
export default function Item({
  title,
  price,
  hearts,
  id,
  image,
  createdAt,
  category,
  status,
  removed = false,
}: ItemProps) {
  return (
    <ProductCard
      product={{
        id,
        name: title,
        price,
        image,
        createdAt,
        category,
        status,
        isDeleted: removed,
        wishCount: hearts,
      }}
    />
  );
}
