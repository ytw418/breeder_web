import type { NextPage, NextPageContext } from "next";
import { Review, User } from "@prisma/client";
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
import MyPostList from "@components/features/myPostList";

interface ReviewWithUser extends Review {
  createdBy: User;
}
interface ReviewsResponse {
  success: boolean;
  reviews: ReviewWithUser[];
}

const MyPageClient = () => {
  const { user } = useUser();
  const router = useRouter();
  const handleLogout = useLogout();

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
              <AvatarImage src={avatarUrl || ""} alt={user?.name || "사용자"} />
              <AvatarFallback>{user?.name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">
                {user?.name || "사용자"}
              </h2>
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

      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/profile/sold"
          className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium">판매내역</span>
        </Link>

        <Link
          href="/profile/bought"
          className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium">구매내역</span>
        </Link>

        <Link
          href="/profile/loved"
          className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium">관심목록</span>
        </Link>
      </div>

      {/* 등록한 게시글 목록 */}
      {user?.id && <MyPostList userId={user?.id} />}
    </div>
  );
};

export default MyPageClient;
