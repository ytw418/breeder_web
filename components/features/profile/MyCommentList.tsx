import React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@components/ui/card";
import { Spinner } from "@components/atoms/Spinner";

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  post: {
    id: number;
    title: string;
  };
}

interface CommentsResponse {
  ok: boolean;
  comments: Comment[];
}

interface MyCommentListProps {
  userId: number;
  limit?: number;
}

const MyCommentList = ({ userId, limit }: MyCommentListProps) => {
  const { data, isLoading } = useSWR<CommentsResponse>(
    `/api/users/${userId}/comments${limit ? `?limit=${limit}` : ""}`
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Spinner />
      </div>
    );
  }

  if (!data?.comments || data.comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        작성한 댓글이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.comments.map((comment) => (
        <Link key={comment.id} href={`/posts/${comment.post.id}`}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{comment.post.title}</h3>
              <span className="text-sm text-gray-500">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">{comment.content}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default MyCommentList; 