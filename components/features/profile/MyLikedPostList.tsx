import React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@components/ui/card";
import { Spinner } from "@components/atoms/Spinner";

interface PostWithUser {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
    avatar?: string;
  };
  _count: {
    comments: number;
    likes: number;
  };
}

interface PostsResponse {
  ok: boolean;
  posts: PostWithUser[];
}

interface MyLikedPostListProps {
  userId: number;
  limit?: number;
}

const MyLikedPostList = ({ userId, limit }: MyLikedPostListProps) => {
  const { data, isLoading } = useSWR<PostsResponse>(
    `/api/users/${userId}/likes${limit ? `?limit=${limit}` : ""}`
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Spinner />
      </div>
    );
  }

  if (!data?.posts || data.posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        좋아요한 게시물이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.posts.map((post) => (
        <Link key={post.id} href={`/posts/${post.id}`}>
          <Card className="p-4">
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
            <h3 className="mt-2 text-lg font-semibold">{post.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">
              {post.content}
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
              <span>댓글 {post._count.comments}</span>
              <span>좋아요 {post._count.likes}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default MyLikedPostList; 