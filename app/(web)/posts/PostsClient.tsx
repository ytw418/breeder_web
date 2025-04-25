"use client";

import { useState } from "react";
import Layout from "@components/features/layout";
import useSWR from "swr";
import { Post } from "@prisma/client";
import Link from "next/link";

interface PostWithUser extends Post {
  author: {
    id: number;
    name: string;
    avatar: string | null;
  };
  _count: {
    comments: number;
    likes: number;
  };
}

interface PostsResponse {
  success: boolean;
  posts: PostWithUser[];
  nextCursor: number | null;
}

export default function PostsClient() {
  const [cursor, setCursor] = useState<number | null>(null);
  const { data, isLoading } = useSWR<PostsResponse>(
    `/api/posts${cursor ? `?cursor=${cursor}` : ""}`
  );

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  if (isLoading) {
    return (
      <Layout canGoBack hasTabBar title="곤충생활" seoTitle="곤충생활">
        <div className="flex flex-col space-y-4 p-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col space-y-2 p-4 border rounded-lg animate-pulse"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
              <div className="h-6 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="flex items-center space-x-4">
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout canGoBack hasTabBar title="곤충생활" seoTitle="곤충생활">
      <div className="flex flex-col space-y-4 p-4">
        {data?.posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="flex flex-col space-y-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                {post.author.avatar && (
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <span className="font-medium">{post.author.name}</span>
            </div>
            <h3 className="text-lg font-semibold">{post.title}</h3>
            <p className="text-gray-600 line-clamp-2">{post.content}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>댓글 {post._count.comments}</span>
              <span>좋아요 {post._count.likes}</span>
            </div>
          </Link>
        ))}
        {data?.nextCursor && (
          <button
            onClick={handleLoadMore}
            className="w-full py-2 text-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            더보기
          </button>
        )}
      </div>
    </Layout>
  );
}
