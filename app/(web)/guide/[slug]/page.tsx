import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Layout from "@components/features/MainLayout";
import JsonLd from "@components/atoms/JsonLd";
import GuideToc from "@components/features/guide/GuideToc";
import GuideBody from "@components/features/guide/GuideBody";
import { getGuideDetail, getPublishedGuide } from "@libs/server/guides";
import { GUIDE_INDEX_HREF, guideHref, type SpeciesGuide } from "@libs/shared/guides";
import { SITE_NAME, SITE_URL, toMetaDescription, toPageTitle } from "@libs/shared/seo";

/**
 * 종별 사육 가이드 상세(앱 docs/prd/species-guide.md S-1). 본문은 data/guides/*.json, 회원 데이터는 DB.
 * 처음 요청 때 만들어 60초 캐시한다(ISR, 게시글 상세와 같은 방식). 공개 전(draft)·없는 종은 404.
 */
export const revalidate = 60;
export const generateStaticParams = async () => [];

type Params = Promise<{ slug: string }>;

const readSlug = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const canonicalOf = (guide: SpeciesGuide) => `${SITE_URL}${guideHref(guide.slug)}`;
const descriptionOf = (guide: SpeciesGuide) =>
  toMetaDescription(`${guide.intro} 온도·습도, 먹이, 사육장, 건강, 번식, 한국 신고까지.`, 150);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const guide = getPublishedGuide(readSlug((await params).slug));
  if (!guide) {
    return { title: "가이드를 찾을 수 없습니다", robots: { index: false, follow: false } };
  }
  const canonical = canonicalOf(guide);
  const description = descriptionOf(guide);
  return {
    title: toPageTitle(`${guide.title} — 온도·습도·먹이`),
    description,
    keywords: [guide.species, `${guide.species} 키우기`, `${guide.species} 사육`, `${guide.species} 온도`, `${guide.species} 먹이`, guide.group],
    alternates: { canonical },
    openGraph: { type: "article", title: `${guide.title} | ${SITE_NAME}`, description, url: canonical },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  };
}

export default async function GuidePage({ params }: { params: Params }) {
  const detail = await getGuideDetail(readSlug((await params).slug));
  if (!detail) notFound();
  const { guide } = detail;
  const canonical = canonicalOf(guide);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "사육 가이드", item: `${SITE_URL}${GUIDE_INDEX_HREF}` },
      { "@type": "ListItem", position: 2, name: guide.group, item: `${SITE_URL}${GUIDE_INDEX_HREF}` },
      { "@type": "ListItem", position: 3, name: guide.species, item: canonical },
    ],
  };
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: descriptionOf(guide),
    inLanguage: "ko-KR",
    dateModified: guide.updatedAt,
    mainEntityOfPage: canonical,
    about: guide.species,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    citation: guide.sources.filter((s) => s.url).map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })),
  };

  return (
    <>
      <JsonLd id="guide-breadcrumb-jsonld" data={breadcrumb} />
      <JsonLd id="guide-article-jsonld" data={article} />
      <Layout canGoBack homeAction title="사육 가이드" bodyHasH1>
        <GuideToc />
        <GuideBody detail={detail} />
      </Layout>
    </>
  );
}
