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
import MyPostList from "@components/features/profile/myPostList";
import MySaleHistroy from "@components/features/profile/mySaleHistroy";

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

      <MySaleHistroy />
      {/* 등록한 게시글 목록 */}
      <MyPostList userId={user?.id} />
    </div>
  );
};

export default MyPageClient;
