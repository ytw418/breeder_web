import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@libs/server/apis";
import ProductClient from "./ProductClient";
import client from "@libs/server/client";
import Script from "next/script";
import Image from "@components/atoms/Image";

const CLOUDFLARE_IMAGE_BASE = "https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw";
const DEFAULT_OG_IMAGE = "/opengraph-image";

const toPublicImageUrl = (imageId: string | null | undefined) => {
  if (!imageId) return DEFAULT_OG_IMAGE;
  if (imageId.startsWith("/")) return imageId;
  if (imageId.startsWith("http://") || imageId.startsWith("https://")) {
    return imageId;
  }
  return `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public`;
};

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
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const products = await client.product.findMany({
      select: {
        id: true,
      },
    });

    return products.map((product) => ({
      id: String(product.id),
    }));
  } catch {
    return [];
  }
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
  const data = await getProduct(productId, { mode: "isr", revalidateSeconds: 60 });

  if (!data.success || !data.product) {
    return {
      title: "상품을 찾을 수 없습니다",
      description: "요청한 상품을 찾을 수 없습니다.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { product } = data;
  const description =
    product.description.length > 160
      ? `${product.description.slice(0, 160)}...`
      : product.description;
  const normalizedImages =
    product.photos?.length > 0
      ? product.photos.map((photo) => toPublicImageUrl(photo)).slice(0, 4)
      : [DEFAULT_OG_IMAGE];
  const twitterImage = normalizedImages[0] || DEFAULT_OG_IMAGE;
  const canonicalUrl = `https://bredy.app/products/${product.id}`;
  const keywordSet = new Set<string>([
    "브리디",
    "애완동물 서비스",
    "중고 거래",
    "분양",
    product.name,
  ]);
  if (product.category) keywordSet.add(product.category);
  if (product.productType) keywordSet.add(product.productType);

  return {
    title: `${String(product.name) || "상품 이름 없음"}`,
    description,
    keywords: Array.from(keywordSet),
    openGraph: {
      title: product.name,
      description,
      images: normalizedImages.map((imageUrl) => ({
        url: imageUrl,
        width: 800,
        height: 600,
        alt: product.name,
      })),
      type: "website",
      siteName: "Bredy",
      locale: "ko_KR",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [twitterImage],
    },
    alternates: {
      // alternates 옵션은 페이지의 대체 버전을 지정하는 메타데이터입니다.
      // canonical: 이 페이지의 표준/정식 URL을 지정합니다. 검색엔진이 중복 콘텐츠를 처리할 때 이 URL을 우선적으로 인덱싱합니다.
      // languages: 다국어 지원을 위한 대체 언어 버전의 URL을 지정할 수 있습니다.
      // media: 다양한 미디어 타입(예: print, screen)에 대한 대체 버전을 지정할 수 있습니다.
      // types: 다양한 문서 타입에 대한 대체 버전을 지정할 수 있습니다.
      canonical: canonicalUrl,
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
function generateJsonLd(product: any, imageUrls: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: imageUrls,
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
  const canonicalUrl = `https://bredy.app/products/${product.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "홈",
        item: "https://bredy.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.name,
        item: canonicalUrl,
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
  const data = await getProduct(productId, { mode: "isr", revalidateSeconds: 60 });

  if (!data.success || !data.product) {
    notFound();
  }

  const structuredImageUrls =
    data.product.photos?.length > 0
      ? data.product.photos.map((photo: string) => toPublicImageUrl(photo))
      : [DEFAULT_OG_IMAGE];
  const jsonLd = generateJsonLd(data.product, structuredImageUrls);
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
