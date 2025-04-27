import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@libs/server/apis";
import ProductClient from "./ProductClient";
import client from "@libs/server/client";
import Script from "next/script";
import Image from "next/image";

interface Props {
  params: {
    id: string;
  };
}

/**
 * 정적 페이지 생성을 위한 함수
 * - 빌드 시점에 모든 상품 페이지의 경로를 미리 생성
 * - SEO에 유리하며 페이지 로딩 속도 향상
 */
export async function generateStaticParams() {
  const products = await client.product.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  return products.map((product) => ({
    id: `${product.id}-${product.name}`,
  }));
}

/**
 * 정적 페이지 재생성 주기 설정
 * - 60초마다 페이지 재생성
 * - ISR(Incremental Static Regeneration) 사용
 * - 실시간성과 성능의 균형 유지
 */
export const revalidate = 60;

/**
 * 동적 메타데이터 생성
 * - 검색 엔진 최적화를 위한 메타데이터 설정
 * - OpenGraph, Twitter 카드 등 소셜 미디어 공유 최적화
 * - robots 메타 태그로 검색 엔진 크롤링 제어
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const productId = params.id.split("-")[0];
  const data = await getProduct(productId);

  if (!data.success || !data.product) {
    return {
      title: "상품을 찾을 수 없습니다 | Breeder",
      description: "요청한 상품을 찾을 수 없습니다.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { product } = data;
  const description = product.description.slice(0, 160);

  return {
    title: `${product.name} | Breeder`,
    description: `${description}...`,
    keywords: [
      product.name,
      "외곤",
      "외국곤충",
      "건조표본",
      "헤라클레스",
      "사슴벌레",
      "극태",
      "왕사",
      "장수풍뎅이",
    ],
    openGraph: {
      title: product.name,
      description: description,
      images: product.photos.map((photo) => ({
        url: photo,
        width: 800,
        height: 600,
        alt: product.name,
      })),
      type: "website",
      siteName: "Breeder",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: description,
      images: product.photos[0],
    },
    alternates: {
      canonical: `https://breeder-web.vercel.app/products/${params.id}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

/**
 * 상품 정보를 위한 JSON-LD 구조화 데이터 생성
 * - 검색 엔진이 상품 정보를 더 잘 이해할 수 있도록 함
 * - 가격, 판매자, 이미지 등 상세 정보 포함
 * - 검색 결과에서 리치 스니펫 표시 가능성 증가
 */
function generateJsonLd(product: any) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.photos,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "KRW",
      availability: "https://schema.org/InStock",
    },
    seller: {
      "@type": "Person",
      name: product.user.name,
    },
  };
}

/**
 * 브레드크럼 네비게이션을 위한 JSON-LD 생성
 * - 사이트 구조를 검색 엔진에 명확히 전달
 * - 사용자 경험 개선
 * - 검색 결과에서 사이트 구조 표시 가능
 */
function generateBreadcrumbJsonLd(product: any) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "홈",
        item: "https://breeder-web.vercel.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.name,
        item: `https://breeder-web.vercel.app/products/${product.id}`,
      },
    ],
  };
}

/**
 * 상품 상세 페이지 컴포넌트
 * - 정적 생성된 페이지 렌더링
 * - SEO 최적화된 메타데이터 적용
 * - 구조화된 데이터 포함
 * - 브레드크럼 네비게이션 제공
 */
export default async function ProductPage({ params }: Props) {
  const productId = params.id.split("-")[0];
  const data = await getProduct(productId);

  if (!data.success || !data.product) {
    notFound();
  }

  const jsonLd = generateJsonLd(data.product);
  const breadcrumbJsonLd = generateBreadcrumbJsonLd(data.product);

  return (
    <>
      {/* 구조화된 데이터 스크립트 */}
      <Script
        id="product-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Script
        id="breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* 브레드크럼 네비게이션 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex py-3 text-gray-700" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <a href="/" className="text-gray-700 hover:text-primary">
                홈
              </a>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="ml-1 text-gray-500 md:ml-2">
                  {data.product.name}
                </span>
              </div>
            </li>
          </ol>
        </nav>
        <ProductClient
          product={data.product}
          relatedProducts={data.relatedProducts}
          success={data.success}
        />
      </div>
    </>
  );
}
