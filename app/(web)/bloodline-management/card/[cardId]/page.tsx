import { Suspense } from "react";
import { notFound } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { BloodlineHeader, BloodlineSpinner } from "@components/features/bloodline/BloodlineScreenParts";
import type { Metadata } from "next";
import {
  BLOODLINE_OG_DEFAULT_DESCRIPTION,
  BLOODLINE_OG_DEFAULT_TITLE,
  BLOODLINE_OG_SITE_URL,
  bloodlineOgDescription,
  bloodlineOgTitle,
  bloodlinePublicPath,
  loadBloodlineOgPayload,
  type BloodlineOgPayload,
} from "@libs/server/bloodline-og";
import BloodlineCardDetailClient from "./BloodlineCardDetailClient";
import ExploreMore from "@components/app/ExploreMore";
import { getExploreMore } from "@libs/server/exploreMore";

/**
 * 다른 상세와 같이 요청 시 ISR(60초). 본문은 화면이 받고, 서버는 메타·'더 둘러보기' 링크만 만든다.
 */
export const revalidate = 60;
export const generateStaticParams = async () => [];

type Params = {
  cardId: string;
};

type Props = {
  params: Promise<Params>;
};

const parseCardId = (cardId: string) => {
  const parsed = Number(cardId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// 루트 레이아웃 title.template("%s | 브리디")을 타지 않게 absolute 로 준다.
const DEFAULT_METADATA: Metadata = {
  title: { absolute: BLOODLINE_OG_DEFAULT_TITLE },
  description: BLOODLINE_OG_DEFAULT_DESCRIPTION,
};

const NOINDEX_METADATA: Metadata = {
  ...DEFAULT_METADATA,
  robots: { index: false, follow: false },
};

/**
 * 공유 미리보기(PRD S-10). ACTIVE 혈통(출처 카드 id 면 뿌리 기준)만 이름·종·산지를 싣는다.
 * 회수·숨김·없는 카드는 기본 제목 + noindex. 조회 오류는 페이지를 깨지 않도록 기본 제목만 준다.
 * og:image·twitter:image 는 같은 폴더의 opengraph-image.tsx·twitter-image.tsx 파일 규약이 넣는다.
 * 여기서 images 를 직접 적으면 안 된다: 라우트 그룹 (web) 아래 파일 규약 이미지는 실제 경로에 해시가 붙어
 * (/bloodline-management/card/{id}/opengraph-image-xxxxxx) "…/opengraph-image" 로 적으면 404 가 된다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cardId } = await params;
  const id = parseCardId(cardId);
  if (!id) return NOINDEX_METADATA;

  let payload: BloodlineOgPayload | null;
  try {
    payload = await loadBloodlineOgPayload(id);
  } catch (error) {
    console.warn("[bloodline-og] 메타데이터 조회 실패", error);
    return DEFAULT_METADATA;
  }
  if (!payload) return NOINDEX_METADATA;

  const title = bloodlineOgTitle(payload);
  const description = bloodlineOgDescription(payload);
  const canonicalUrl = `${BLOODLINE_OG_SITE_URL}${bloodlinePublicPath(id)}`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "Bredy",
      url: canonicalUrl,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function BloodlineCardDetailPage({ params }: Props) {
  const { cardId } = await params;
  const parsedCardId = parseCardId(cardId);
  if (!parsedCardId) {
    notFound();
  }

  let payload: BloodlineOgPayload | null = null;
  try {
    payload = await loadBloodlineOgPayload(parsedCardId);
  } catch {
    payload = null;
  }
  const explore = await getExploreMore({ kind: "bloodline", speciesType: payload?.speciesType ?? null });

  // 종을 모르는 혈통은 같은 종을 고를 수 없어 최근 분양글을 보인다(exploreMore loadSimilar).
  const footer = (
    <ExploreMore data={explore} similarTitle={payload?.speciesType ? "같은 종 분양" : "최근 분양"} />
  );

  // 본문은 useSearchParams 를 써서 서버(ISR)에선 Suspense fallback 까지만 그려진다. fallback 에 헤더·'더 둘러보기'를
  // 넣어 서버 HTML 에도 링크가 남게 한다(화면이 붙으면 본문의 로딩 → 내용으로 바뀐다).
  return (
    <Suspense
      fallback={
        <Layout headerVariant="none" seoTitle={payload?.name ?? "혈통"}>
          <BloodlineHeader title="혈통" showHome />
          <div className="flex min-h-[60vh] items-center justify-center">
            <BloodlineSpinner />
          </div>
          {footer}
        </Layout>
      }
    >
      <BloodlineCardDetailClient cardId={parsedCardId} footer={footer} />
    </Suspense>
  );
}
