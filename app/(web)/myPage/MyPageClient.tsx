import type { NextPage, NextPageContext } from "next";
import { Review, User, Post } from "@prisma/client";
import useSWR, { SWRConfig } from "swr";

import Layout from "@components/features/layout";
import Link from "next/link";
import client from "@libs/server/client";
import { cls } from "@libs/client/utils";
import useUser from "@libs/client/useUser";
import Image from "next/image";
import Icon from "@libs/Icon";
import { Button } from "@components/ui/button";
import { useRouter } from "next/navigation";
import useLogout from "../../../hooks/useLogout";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import { Card, CardContent } from "@components/ui/card";
import MyPostList from "@components/features/profile/MyPostList";
import MySaleHistroyMenu from "@components/features/profile/MySaleHistroyMenu";
import { makeImageUrl } from "@libs/client/utils";
import MyCommentList from "@components/features/profile/MyCommentList";
import MyLikedPostList from "@components/features/profile/MyLikedPostList";

interface ReviewWithUser extends Review {
  createdBy: User;
}
interface ReviewsResponse {
  success: boolean;
  reviews: ReviewWithUser[];
}

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

interface Comment {
  id: number;
  content: string;
  createdAt: Date;
  post: {
    id: number;
    title: string;
  };
}

const MyPageClient = () => {
  const { user } = useUser();
  const router = useRouter();
  const handleLogout = useLogout();

  const { data: postsData } = useSWR<{ success: boolean; posts: PostWithUser[] }>(
    user?.id ? `/api/users/${user.id}/posts` : null
  );
  const { data: commentsData } = useSWR<{ success: boolean; comments: Comment[] }>(
    user?.id ? `/api/users/${user.id}/comments` : null
  );
  const { data: likesData } = useSWR<{ success: boolean; posts: PostWithUser[] }>(
    user?.id ? `/api/users/${user.id}/likes` : null
  );

  const avatarUrl =
    user?.avatar &&
    (user.avatar.includes("http")
      ? user.avatar
      : `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${user.avatar}/avatar`);

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-8">
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl || ""} alt={user?.name || ""} />
              <AvatarFallback></AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{user?.name || ""}</h2>
              <p className="text-sm text-gray-500">{user?.email || ""}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={() => router.push("/editProfile")}
            >
              프로필 수정
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleLogout}
            >
              로그아웃
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 내 상품 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">내 상품</h3>
            <span className="text-sm text-gray-500">(최근 3건만 보여줍니다)</span>
          </div>
        </div>
        <MySaleHistroyMenu limit={3} />
      </div>

      {/* 내 게시물 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">내 게시물</h3>
            <span className="text-sm text-gray-500">(최근 3건만 보여줍니다)</span>
          </div>
          {user?.id && (
            <Link href={`/posts?author=${user.id}`}>
              <Button variant="ghost" size="sm">
                더보기
              </Button>
            </Link>
          )}
        </div>
        {user?.id && <MyPostList userId={user.id} limit={3} />}
      </div>

      {/* 내 댓글 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">내 댓글</h3>
            <span className="text-sm text-gray-500">(최근 3건만 보여줍니다)</span>
          </div>
        </div>
        {user?.id && <MyCommentList userId={user.id} limit={3} />}
      </div>

      {/* 좋아요한 게시물 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">좋아요한 게시물</h3>
            <span className="text-sm text-gray-500">(최근 3건만 보여줍니다)</span>
          </div>
        </div>
        {user?.id && <MyLikedPostList userId={user.id} limit={3} />}
      </div>
    </div>
  );
};

export default MyPageClient;
