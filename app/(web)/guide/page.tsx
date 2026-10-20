import type { Metadata } from "next";
import Layout from "@components/features/MainLayout";
import JsonLd from "@components/atoms/JsonLd";
import GuideIndexList from "@components/features/guide/GuideIndexList";
import { getGuideList } from "@libs/server/guides";
import { GUIDE_INDEX_HREF, guideHref } from "@libs/shared/guides";
import { SITE_URL } from "@libs/shared/seo";

/** 종별 사육 가이드 목록(앱 docs/prd/species-guide.md S-2). 공개된 가이드만 분류표 순서로. */
export const revalidate = 300;

const canonical = `${SITE_URL}${GUIDE_INDEX_HREF}`;

export const metadata: Metadata = {
  title: "사육 가이드 — 파충류·곤충·물고기 키우는 법",
  description: "크레스티드 게코부터 장수풍뎅이까지, 온도·습도·먹이·사육장·건강·번식과 한국에서 해야 하는 신고를 종마다 정리한 브리디 사육 가이드.",
  alternates: { canonical },
  openGraph: { type: "website", title: "사육 가이드 | 브리디", url: canonical },
};

export default async function GuideIndexPage() {
  const { groups } = await getGuideList();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "브리디 사육 가이드",
    itemListElement: groups
      .flatMap((g) => g.guides)
      .map((guide, i) => ({ "@type": "ListItem", position: i + 1, name: guide.title, url: `${SITE_URL}${guideHref(guide.slug)}` })),
  };
  return (
    <>
      <JsonLd id="guide-index-jsonld" data={itemList} />
      <Layout canGoBack homeAction title="사육 가이드">
        <GuideIndexList groups={groups} />
      </Layout>
    </>
  );
}
