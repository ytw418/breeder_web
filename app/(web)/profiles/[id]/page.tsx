import React from "react";
import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";
import client from "@libs/server/client";
import JsonLd from "@components/atoms/JsonLd";
import { SITE_OG_IMAGE } from "@libs/shared/ogImage";
import { SITE_URL, toMetaDescription, toPublicImageUrl } from "@libs/shared/seo";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * 프로필은 화면이 SWR 로 그리고, 서버는 검색·공유용 메타와 구조화 데이터만 만든다.
 * 요청이 처음 올 때 만들어 5분 캐시한다(ISR).
 */
export const revalidate = 300;
export const generateStaticParams = async () => [];

const getProfileForSeo = async (rawId: string) => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return null;
  try {
    return await client.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        profileLink: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            posts: { where: { isHidden: false } },
            products: { where: { isHidden: false, isDeleted: false } },
          },
        },
      },
    });
  } catch {
    return null;
  }
};

type ProfileForSeo = NonNullable<Awaited<ReturnType<typeof getProfileForSeo>>>;

const isPublicProfile = (user: ProfileForSeo | null): user is ProfileForSeo =>
  Boolean(user && user.status !== "DELETED" && user.status !== "BANNED");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getProfileForSeo(id);
  if (!isPublicProfile(user)) {
    return {
      title: "프로필을 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${SITE_URL}/profiles/${user.id}`;
  const counts = `게시글 ${user._count.posts}개 · 분양글 ${user._count.products}개`;
  const description = toMetaDescription(
    user.bio ? `${user.bio} · ${counts}` : `브리디 브리더 ${user.name}님의 프로필. ${counts}`,
    150
  );
  const image = user.avatar ? toPublicImageUrl(user.avatar, SITE_OG_IMAGE, "avatar") : SITE_OG_IMAGE;
  // 글이 하나도 없는 프로필은 검색 결과에 빈 페이지로 보이니 색인하지 않는다(링크는 따라간다).
  const hasContent = user._count.posts + user._count.products > 0;

  return {
    title: `${user.name} - 브리더 프로필`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title: `${user.name} | 브리디 프로필`,
      description,
      url: canonical,
      images: [{ url: image, alt: `${user.name} 프로필 사진` }],
    },
    twitter: {
      card: "summary",
      title: `${user.name} | 브리디 프로필`,
      description,
      images: [image],
    },
    robots: { index: hasContent, follow: true },
  };
}

const generateProfileJsonLd = (user: ProfileForSeo) => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  dateCreated: user.createdAt.toISOString(),
  mainEntity: {
    "@type": "Person",
    name: user.name,
    identifier: String(user.id),
    url: `${SITE_URL}/profiles/${user.id}`,
    ...(user.bio ? { description: user.bio } : {}),
    ...(user.avatar ? { image: toPublicImageUrl(user.avatar, SITE_OG_IMAGE, "avatar") } : {}),
    ...(user.profileLink ? { sameAs: [user.profileLink] } : {}),
    agentInteractionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/WriteAction",
      userInteractionCount: user._count.posts + user._count.products,
    },
  },
});

const page = async ({ params }: Props) => {
  const { id } = await params;
  const user = await getProfileForSeo(id);
  return (
    <>
      {isPublicProfile(user) ? <JsonLd id="profile-jsonld" data={generateProfileJsonLd(user)} /> : null}
      <ProfileClient />
    </>
  );
};

export default page;
