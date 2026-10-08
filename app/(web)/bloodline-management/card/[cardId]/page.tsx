import { notFound } from "next/navigation";
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

// 루트 레이아웃 title.template("%s | Bredy")을 타지 않게 absolute 로 준다.
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

  return <BloodlineCardDetailClient cardId={parsedCardId} />;
}
