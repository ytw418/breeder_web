import type { Product } from "@prisma/client";

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

export interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
  /** 조건에 맞는 전체 상품 수(앱 상품 목록 "전체 N개") */
  total: number;
}

export interface HomeBanner {
  id: number;
  title: string;
  description: string;
  href: string;
  bgClass: string;
  order: number;
  image?: string | null;
}
