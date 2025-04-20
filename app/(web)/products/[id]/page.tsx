import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@libs/server/apis";
import ProductClient from "./ProductClient";
import client from "@libs/server/client";

interface Props {
  params: {
    id: string;
  };
}

// 정적 경로 생성
export async function generateStaticParams() {
  const products = await client.product.findMany({
    select: {
      id: true,
    },
  });

  return products.map((product) => ({
    id: product.id.toString(),
  }));
}

// 정적 페이지 재생성 주기 설정 (초 단위)
export const revalidate = 60; // 1시간마다 재생성

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProduct(params.id);

  if (!data.success || !data.product) {
    return {
      title: "상품을 찾을 수 없습니다 | Breeder",
      description: "요청한 상품을 찾을 수 없습니다.",
    };
  }

  const { product } = data;
  const description = product.description.slice(0, 160);

  return {
    title: `${product.name} | Breeder`,
    description: `${description}...`,
    openGraph: {
      title: product.name,
      description: description,
      images: product.photos.map((photo) => ({
        url: photo,
        width: 800,
        height: 600,
        alt: product.name,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: description,
      images: product.photos[0],
    },
    alternates: {
      canonical: `https://breeder.com/products/${params.id}`,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const data = await getProduct(params.id);

  if (!data.success || !data.product) {
    notFound();
  }

  return (
    <ProductClient
      product={data.product}
      relatedProducts={data.relatedProducts}
      success={data.success}
    />
  );
}
