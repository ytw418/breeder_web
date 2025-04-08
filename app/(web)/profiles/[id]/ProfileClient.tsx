"use client";
import Profile from "@components/atoms/Profile";
import { useParams, useRouter } from "next/navigation";

import React from "react";
import useSWR from "swr";
import MainLayout from "@components/features/layout";
import { Button } from "@components/ui/button";
import useMutation from "@libs/client/useMutation";
import { ChatResponseType } from "pages/api/chat";
import { UserResponse } from "pages/api/users/[id]";
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
      <div className="flex px-4 flex-col">
        <div className="mt-4" />
        <Profile user={data?.user} />
        <div className="mt-5" />
        <div className="flex flex-row gap-1">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() =>
              getChatRoomId({
                data: { otherId: Number(query?.id) },
                onCompleted(result) {
                  if (result.success) {
                    router.push(`/chat/${result.ChatRoomId}`);
                  } else {
                    alert(result.error);
                  }
                },
                onError(error) {
                  alert(error);
                },
              })
            }
          >
            메시지
          </Button>
          <Button variant="default" size="sm" className="flex-2">
            팔로우
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfileClient;
