"use client";
import Profile from "@components/atoms/Profile";
import { useParams, useRouter } from "next/navigation";
import { UserResponse } from "pages/api/users/[id]";
import React from "react";
import useSWR from "swr";
import MainLayout from "@components/layout";
import { Spacing } from "@components/atoms/Spacing";
import Button from "@components/atoms/Button";
import useMutation from "@libs/client/useMutation";
import { ChatResponseType } from "pages/api/chat";
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
        <Spacing size={16} />
        <Profile user={data?.user} />
        <Spacing size={20} />
        <div className="flex flex-row gap-1">
          <Button
            type={"squareDefault"}
            text={"메시지"}
            size={"small"}
            className="flex-1"
            clickAction={() =>
              getChatRoomId({
                data: { otherId: query?.id },
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
          />
          <Button
            type={"squareDefault"}
            text={"팔로우"}
            size={"small"}
            className="flex-2"
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfileClient;
