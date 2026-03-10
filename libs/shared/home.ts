import type { Product } from "@prisma/client";

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

export interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
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
