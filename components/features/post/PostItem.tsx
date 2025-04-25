import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Post } from "@prisma/client";
import { makeImageUrl } from "@libs/client/utils";

interface PostItemProps {
  post: {
    id: number;
    title: string;
    content: string;
    image?: string | null;
    author: {
      id: number;
      name: string;
      avatar: string | null;
    };
    _count: {
      comments: number;
      likes: number;
    };
  };
}

const PostItem = ({ post }: PostItemProps) => {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="pt-5 cursor-pointer"
    >
      <div className="flex space-x-4">
        {post.image && (
          <div className="relative w-20 h-20 rounded-md overflow-hidden">
            <Image
              src={makeImageUrl(post.image, "public")}
              className="object-cover"
              alt="post"
              fill
            />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">{post.title}</h3>
          <p className="mt-1 text-xs text-gray-500">{post.content}</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {post.author.avatar ? (
                <Image
                  src={makeImageUrl(post.author.avatar, "avatar")}
                  className="w-6 h-6 rounded-full"
                  width={24}
                  height={24}
                  alt="avatar"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-300" />
              )}
              <span className="text-xs font-medium text-gray-700">
                {post.author.name}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>댓글 {post._count.comments}</span>
              <span>좋아요 {post._count.likes}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PostItem; 