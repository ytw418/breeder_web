import React from "react";
import PostClient from "./PostClient";
import { getPost } from "@libs/server/apis";
import { extractPostIdFromPath, toPostPath } from "@libs/post-route";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const SITE_URL = "https://bredy.app";
const DEFAULT_POST_IMAGE = "/opengraph-image";

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
  params: { id: string };
}): Promise<Metadata> {
  const postId = extractPostIdFromPath(params.id);
  if (Number.isNaN(postId)) {
    return {
      title: "게시글을 찾을 수 없습니다 | 브리디",
      description:
        "요청하신 게시글을 찾을 수 없거나 삭제된 게시글입니다.",
      robots: {
        index: false,
        follow: false,
      },
      alternates: {
        canonical: `${SITE_URL}/posts`,
      },
    };
  }

  const data = await getPost(String(postId));
  const canonical = getPostCanonical(postId, data.post?.title);

  if (!data.success || !data.post) {
    return {
      title: "게시글을 찾을 수 없습니다 | 브리디",
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

  const title = `${data.post.title} | 브리디 게시글`;
  const description = trimText(
    `${data.post.description} ${data.post.user?.name ? `(작성자 ${data.post.user.name})` : ""}`,
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
      title,
      description,
      url: canonical,
      images: [
        {
          url: DEFAULT_POST_IMAGE,
          width: 1200,
          height: 630,
          alt: `${data.post.title} 게시글 공유 이미지`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_POST_IMAGE],
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

const page = async ({ params: { id } }: { params: { id: string } }) => {
  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    notFound();
  }

  const data = await getPost(String(postId));
  if (!data.success || !data.post) {
    notFound();
  }

  return (
    <div>
      <PostClient {...data} />
    </div>
  );
};

export default page;
