import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, throwIfTransientFailure } from "@libs/server/apis";
import { extractProductId, getProductPath } from "@libs/product-route";
import {
  displayUserName,
  normalizeDeletedUserNames,
} from "@libs/shared/deletedUser";
import ProductClient from "./ProductClient";
import AppOpenBanner from "@components/features/AppOpenBanner";
import JsonLd from "@components/atoms/JsonLd";
import { SITE_OG_IMAGE } from "@libs/shared/ogImage";
import {
  SITE_URL,
  productAvailability,
  toMetaDescription,
  toPageTitle,
  toPublicImageUrl as toSeoImageUrl,
} from "@libs/shared/seo";
import { dealTypeLabel, productStatusLabel } from "@libs/shared/productTerms";
import ExploreMore from "@components/app/ExploreMore";
import CoupangBanner from "@components/app/ads/CoupangBanner";
import { getExploreMore } from "@libs/server/exploreMore";

const DEFAULT_OG_IMAGE = SITE_OG_IMAGE;
const toPublicImageUrl = (imageId: string | null | undefined) =>
  toSeoImageUrl(imageId, DEFAULT_OG_IMAGE);

interface Props {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 상세는 요청이 처음 올 때 만들어 60초 캐시한다(ISR). 빌드 때는 미리 만들지 않는다.
 * 2026-03-31 Next 16.2 에서 한글 slug 가 x-next-cache-tags 헤더를 깨뜨려(ERR_INVALID_CHAR, next.js#92145)
 * force-dynamic 으로 돌렸다가, 16.4 에서 태그를 인코딩하도록 고쳐져 ISR 로 되돌렸다.
 * 로그인 사용자별 값(관심·내 글 여부)은 화면에서 다시 받는다.
 */
export const revalidate = 60;
export const generateStaticParams = async () => [];
const PRODUCT_REVALIDATE_SECONDS = 60;

/**
 * 동적 메타데이터 생성
 * - 검색 엔진 최적화를 위한 메타데이터 설정
 * - OpenGraph, Twitter 카드 등 소셜 미디어 공유 최적화
 * - robots 메타 태그로 검색 엔진 크롤링 제어
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const productId = extractProductId(id);
  const data = await getProduct(productId, { revalidateSeconds: PRODUCT_REVALIDATE_SECONDS });
  throwIfTransientFailure(data);

  if (!data.success || !data.product) {
    return {
      title: "분양글을 찾을 수 없습니다",
      description: "요청한 분양글을 찾을 수 없습니다.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { product } = data;
  // 검색 결과·AI 답변에 그대로 인용되도록 상태·거래 유형·종을 앞에 둔다.
  const facts = [
    productStatusLabel(product.status),
    dealTypeLabel(product.dealType),
    product.category,
  ].filter(Boolean);
  const description = toMetaDescription(
    `${facts.length ? `[${facts.join(" · ")}] ` : ""}${product.description}`,
    160
  );
  const normalizedImages =
    product.photos?.length > 0
      ? product.photos.map((photo) => toPublicImageUrl(photo)).slice(0, 4)
      : [DEFAULT_OG_IMAGE];
  const twitterImage = normalizedImages[0] || DEFAULT_OG_IMAGE;
  const canonicalUrl = `${SITE_URL}${getProductPath(product.id, product.name)}`;
  const keywordSet = new Set<string>([
    "브리디",
    "반려동물",
    "분양",
    "반려동물 분양",
    product.name,
  ]);
  if (product.category) keywordSet.add(product.category);
  if (product.productType) keywordSet.add(product.productType);

  return {
    title: toPageTitle(String(product.name) || "제목 없음", product.category ? `${product.category} 분양` : null),
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

type ProductForSeo = NonNullable<Awaited<ReturnType<typeof getProduct>>["product"]>;

/**
 * 분양글 구조화 데이터. 가격·상태·분양자·종을 검색엔진과 AI 검색이 읽게 한다.
 */
function generateJsonLd(product: ProductForSeo, imageUrls: string[]) {
  const url = `${SITE_URL}${getProductPath(product.id, product.name)}`;
  const sellerName = displayUserName(product.user?.name);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: imageUrls,
    url,
    ...(product.category ? { category: product.category } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: product.price ?? 0,
      priceCurrency: "KRW",
      availability: productAvailability(product.status),
      seller: {
        "@type": "Person",
        name: sellerName,
        ...(product.user?.id ? { url: `${SITE_URL}/profiles/${product.user.id}` } : {}),
      },
    },
  };
}

/** 브레드크럼: 홈 → 분양 → 이 글. */
function generateBreadcrumbJsonLd(product: ProductForSeo) {
  const canonicalUrl = `${SITE_URL}${getProductPath(product.id, product.name)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "분양", item: `${SITE_URL}/products` },
      { "@type": "ListItem", position: 3, name: product.name, item: canonicalUrl },
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
  const data = await getProduct(productId, { revalidateSeconds: PRODUCT_REVALIDATE_SECONDS });
  throwIfTransientFailure(data);

  if (!data.success || !data.product) {
    // 삭제·숨김 상품은 비로그인 SSR 에서 404(PRODUCT_HIDDEN)다. 소유자는 토큰으로 다시 받아 안내를 봐야 하므로
    // 이 경우만 클라이언트에 맡긴다(메타데이터는 noindex). 그 밖의 없는 상품은 404.
    // 서버 오류 문구가 '상품'에서 '분양글'로 바뀌어도(2026-10-10 용어 결정) 둘 다 받는다.
    if (data.error?.includes("숨겨진 상품") || data.error?.includes("숨겨진 분양글")) {
      return <ProductClient success={false} />;
    }
    notFound();
  }

  const structuredImageUrls =
    data.product.photos?.length > 0
      ? data.product.photos.map((photo: string) => toPublicImageUrl(photo))
      : [DEFAULT_OG_IMAGE];
  const jsonLd = generateJsonLd(data.product, structuredImageUrls);
  // 비슷한 분양은 화면의 2열 그리드(API relatedProducts)가 그린다. 여기선 인기 글·광고·바로가기만.
  const explore = await getExploreMore(
    { kind: "product", id: data.product.id, category: data.product.category },
    { includeSimilar: false }
  );
  const breadcrumbJsonLd = generateBreadcrumbJsonLd(data.product);

  return (
    <>
      <AppOpenBanner />
      <JsonLd id="product-jsonld" data={jsonLd} />
      <JsonLd id="breadcrumb-jsonld" data={breadcrumbJsonLd} />
      <ProductClient
        product={normalizeDeletedUserNames(data.product)}
        relatedProducts={normalizeDeletedUserNames(data.relatedProducts)}
        // 공개 거래 후기(비로그인 응답이라 숨긴 후기는 없다). 로그인하면 화면이 다시 받은 값으로 바꾼다.
        review={data.review ?? null}
        success={data.success}
        footer={
          <ExploreMore
            data={explore}
            similarTitle="비슷한 분양"
            // 분양·경매 화면은 AdSense 대신 쿠팡만 둔다(생물 거래 콘텐츠 수익화 정책). 숨김·삭제 글에는 없다.
            ad={data.product.isDeleted || data.product.isHidden ? null : <CoupangBanner />}
          />
        }
      />
    </>
  );
}
