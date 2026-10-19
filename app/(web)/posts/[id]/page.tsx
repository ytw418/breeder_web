import React from "react";
import PostClient from "./PostClient";
import { getPost, throwIfTransientFailure } from "@libs/server/apis";
import { extractPostIdFromPath, toPostPath } from "@libs/post-route";
import { notFound } from "next/navigation";
import {
  displayUserName,
  normalizeDeletedUserNames,
} from "@libs/shared/deletedUser";
import { toPostPlainText } from "@libs/shared/post-body";
import type { Metadata } from "next";
import { SITE_OG_IMAGE } from "@libs/shared/ogImage";
import JsonLd from "@components/atoms/JsonLd";
import { SITE_URL, toPageTitle, toPublicImageUrl } from "@libs/shared/seo";
import ExploreMore from "@components/app/ExploreMore";
import AdSenseUnit from "@components/app/ads/AdSenseUnit";
import { isNoticePostInput } from "@libs/server/postNotice";
import { getExploreMore } from "@libs/server/exploreMore";

const DEFAULT_POST_IMAGE = SITE_OG_IMAGE;
/** 구조화 데이터에 넣는 댓글 수. 토론·질문 답변이 AI 답변에 인용되도록 앞쪽 몇 개만 싣는다. */
const JSON_LD_COMMENT_LIMIT = 10;

/**
 * 상세는 요청이 처음 올 때 만들어 60초 캐시한다(ISR, 상품 상세와 같은 이유 — products/[id]/page.tsx).
 * ?commentId= 는 서버에서 읽지 않고 PostClient 가 읽는다(서버에서 읽으면 매 요청 렌더링이 된다).
 */
export const revalidate = 60;
export const generateStaticParams = async () => [];
const POST_REVALIDATE_SECONDS = 60;

const trimText = (value: string, length: number) => {
  const normalized = value.trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  if (normalized.length <= length) return normalized;
  return `${normalized.slice(0, length)}...`;
};

const getPostCanonical = (id: number, title?: string | null) =>
  `${SITE_URL}${toPostPath(id, title)}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return {
      title: "게시글을 찾을 수 없습니다",
      description:
        "요청하신 게시글을 찾을 수 없거나 삭제된 게시글입니다.",
      robots: {
        index: false,
        follow: false,
      },
      alternates: {
        canonical: SITE_URL,
      },
    };
  }

  const data = await getPost(String(postId), { revalidateSeconds: POST_REVALIDATE_SECONDS });
  throwIfTransientFailure(data);
  const canonical = getPostCanonical(postId, data.post?.title);

  if (!data.success || !data.post) {
    return {
      title: "게시글을 찾을 수 없습니다",
      description:
        "요청하신 게시글을 찾을 수 없습니다. 존재하지 않거나 삭제된 게시글입니다.",
      robots: {
        index: false,
        follow: false,
      },
      alternates: {
        canonical,
      },
    };
  }

  // 페이지 제목은 레이아웃 템플릿이 ' | 브리디'를 붙인다. 공유 미리보기 제목엔 직접 붙인다.
  const title = toPageTitle(data.post.title, data.post.category);
  const shareTitle = `${data.post.title} | 브리디`;
  const firstImage = data.post.images?.[0] || data.post.image;
  const shareImage = firstImage ? toPublicImageUrl(firstImage, DEFAULT_POST_IMAGE) : DEFAULT_POST_IMAGE;
  // 찬반 토론은 공유 미리보기에 선택지·참여 수를 보인다(앱 docs/prd/live-talk.md §3.6).
  const debate = data.debate;
  const description = debate
    ? `${debate.optionA} vs ${debate.optionB} · ${debate.participants}명 참여 · ${
        debate.state === "open" ? "너는 어느 쪽?" : "결과 보기"
      }`
    : trimText(
    `${toPostPlainText(data.post.description)} ${data.post.user?.name ? `(작성자 ${displayUserName(data.post.user.name)})` : ""}`,
    140
  );

  return {
    title,
    description: `${description} · 댓글 ${data.post._count.comments}개`,
    keywords: [
      "브리디 게시글",
      "반려생활",
      "반려동물 커뮤니티",
      data.post.title,
      data.post.category || "",
    ]
      .map((value) => String(value))
      .filter(Boolean),
    openGraph: {
      type: "article",
      title: shareTitle,
      description,
      url: canonical,
      images: [
        {
          url: shareImage,
          ...(firstImage ? {} : { width: 1200, height: 630 }),
          alt: `${data.post.title} 게시글 공유 이미지`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [shareImage],
    },
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

type PostForSeo = NonNullable<Awaited<ReturnType<typeof getPost>>["post"]>;

/**
 * 게시글 구조화 데이터(DiscussionForumPosting). 구글 '토론 및 포럼' 결과와 AI 검색이
 * 질문·답(댓글)을 읽게 한다. 숨김·삭제 댓글은 넣지 않는다.
 */
function generatePostJsonLd(post: PostForSeo) {
  const url = getPostCanonical(post.id, post.title);
  const images = (post.images?.length ? post.images : post.image ? [post.image] : []).map((image) =>
    toPublicImageUrl(image, DEFAULT_POST_IMAGE)
  );
  const comments = (post.comments ?? [])
    .filter((comment) => !comment.isHidden && !comment.deletedAt && comment.comment?.trim())
    .slice(0, JSON_LD_COMMENT_LIMIT)
    .map((comment) => ({
      "@type": "Comment",
      text: comment.comment,
      datePublished: new Date(comment.createdAt).toISOString(),
      author: {
        "@type": "Person",
        name: displayUserName(comment.user?.name),
        url: `${SITE_URL}/profiles/${comment.user?.id}`,
      },
    }));
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    text: toPostPlainText(post.description),
    url,
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    ...(images.length ? { image: images } : {}),
    ...(post.category ? { articleSection: post.category } : {}),
    author: {
      "@type": "Person",
      name: displayUserName(post.user?.name),
      url: `${SITE_URL}/profiles/${post.user?.id}`,
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post._count?.Likes ?? 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post._count?.comments ?? 0,
      },
    ],
    commentCount: post._count?.comments ?? 0,
    ...(comments.length ? { comment: comments } : {}),
  };
}

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    notFound();
  }

  const data = await getPost(String(postId), { revalidateSeconds: POST_REVALIDATE_SECONDS });
  throwIfTransientFailure(data);
  if (!data.success || !data.post) {
    notFound();
  }
  const explore = await getExploreMore({ kind: "post", id: data.post.id, category: data.post.category });
  // 운영 공지·숨김 글에는 광고를 두지 않는다(앱과 같다).
  const showAds = !isNoticePostInput(data.post) && !data.post.isHidden;

  return (
    <div>
      <JsonLd id="post-jsonld" data={generatePostJsonLd(data.post)} />
      {/* 댓글은 캐시된 HTML 에 넣지 않는다. 화면이 열리면 PostClient 가 최신 댓글을 받아 그린다. */}
      <PostClient
        {...normalizeDeletedUserNames({ ...data, post: { ...data.post, comments: [] } })}
        footer={
          <ExploreMore
            data={explore}
            similarTitle="비슷한 글"
            ad={showAds ? <AdSenseUnit placement="postDetail" format="rectangle" withGap className="px-4 py-5" /> : null}
          />
        }
      />
    </div>
  );
};

export default page;
