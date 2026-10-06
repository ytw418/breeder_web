import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@libs/server/apis";
import { extractProductId, getProductPath } from "@libs/product-route";
import {
  displayUserName,
  normalizeDeletedUserNames,
} from "@libs/shared/deletedUser";
import ProductClient from "./ProductClient";
import Script from "next/script";

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
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

/**
 * 동적 메타데이터 생성
 * - 검색 엔진 최적화를 위한 메타데이터 설정
 * - OpenGraph, Twitter 카드 등 소셜 미디어 공유 최적화
 * - robots 메타 태그로 검색 엔진 크롤링 제어
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const productId = extractProductId(id);
  const data = await getProduct(productId);

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
  const canonicalUrl = `https://bredy.app${getProductPath(product.id, product.name)}`;
  const keywordSet = new Set<string>([
    "브리디",
    "반려동물",
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
      name: displayUserName(product.user?.name),
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
  const canonicalUrl = `https://bredy.app${getProductPath(product.id, product.name)}`;
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
  const { id } = await params;
  const productId = extractProductId(id);
  const data = await getProduct(productId);

  if (!data.success || !data.product) {
    // 삭제·숨김 상품은 비로그인 SSR 에서 404(PRODUCT_HIDDEN)다. 소유자는 토큰으로 다시 받아 안내를 봐야 하므로
    // 이 경우만 클라이언트에 맡긴다(메타데이터는 noindex). 그 밖의 없는 상품은 404.
    if (data.error?.includes("숨겨진 상품")) {
      return <ProductClient success={false} />;
    }
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
      <ProductClient
        product={normalizeDeletedUserNames(data.product)}
        relatedProducts={normalizeDeletedUserNames(data.relatedProducts)}
        success={data.success}
      />
    </>
  );
}
