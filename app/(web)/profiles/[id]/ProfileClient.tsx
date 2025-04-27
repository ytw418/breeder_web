"use client";
import { useParams, useRouter } from "next/navigation";

import MainLayout from "@components/features/layout";
import MyPostList from "@components/features/profile/myPostList";
import MySaleHistroyMenu from "@components/features/profile/MySaleHistroyMenu";
import { Button } from "@components/ui/button";
import { Card, CardContent } from "@components/ui/card";
import useMutation from "hooks/useMutation";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { ChatResponseType } from "pages/api/chat";
import { UserResponse } from "pages/api/users/[id]";
import useSWR from "swr";
const ProfileClient = () => {
  const router = useRouter();
  const query = useParams();
  const { data, isLoading, error } = useSWR<UserResponse>(
    query && `/api/users/${query.id}`
  );

  const [getChatRoomId, { loading }] =
    useMutation<ChatResponseType>(`/api/chat`);
  return (
    <MainLayout canGoBack title={data?.user?.name} hasTabBar>
      <div className="flex px-4 flex-col space-y-8">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={data?.user?.avatar || ""}
                  alt={data?.user?.name || ""}
                />
                <AvatarFallback></AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">
                  {data?.user?.name || ""}
                </h2>
                <p className="text-sm text-gray-500">
                  {data?.user?.email || ""}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                variant="default"
                size="lg"
                className="w-full"
                onClick={() => router.push(`/chat/${data?.user?.id}`)}
              >
                메시지 보내기
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                // onClick={handleLogout}
              >
                팔로우
              </Button>
            </div>
          </CardContent>
        </Card>

        <MySaleHistroyMenu />

        {/* 등록한 게시글 목록 */}
        {query?.id && <MyPostList userId={Number(query?.id)} />}
      </div>
    </MainLayout>
  );
};

export default ProfileClient;
