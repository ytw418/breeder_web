"use client";

import Layout from "@components/features/MainLayout";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import useUser from "hooks/useUser";
import { makeImageUrl } from "@libs/client/utils";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import SkeletonChat from "@components/atoms/SkeletonChat";
import { ChatListResponse } from "pages/api/chat/chatList";

const ChatClient = () => {
  // 5초마다 채팅 목록 새로고침
  const { data, isLoading } = useSWR<ChatListResponse>("/api/chat/chatList", {
    refreshInterval: 5000,
  });
  const { user } = useUser();

  return (
    <Layout icon hasTabBar title="채팅" seoTitle="채팅">
      <div className="divide-y-[1px]">
        {isLoading
          ? [...Array(10)].map((_, index) => <SkeletonChat key={index} />)
          : data?.chatRooms?.map((chatRoom) => {
              const otherUser = chatRoom.chatRoomMembers.find(
                (member) => member.user.id !== user?.id
              )?.user;
              const lastMessage = chatRoom.lastMessage;

              // 마지막 메시지 미리보기 텍스트
              const lastMessagePreview = lastMessage
                ? lastMessage.type === "IMAGE"
                  ? "사진을 보냈습니다"
                  : lastMessage.message
                : "메시지가 없습니다.";

              return (
                <Link
                  key={chatRoom.id}
                  href={`/chat/${chatRoom.id}`}
                  className="flex px-4 cursor-pointer py-3 items-center space-x-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="relative">
                    {otherUser?.avatar ? (
                      <Image
                        width={48}
                        height={48}
                        src={makeImageUrl(otherUser.avatar, "avatar")}
                        className="w-12 h-12 rounded-full bg-gray-200"
                        alt="프로필"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900">
                        {otherUser?.name || "알 수 없음"}
                      </p>
                      {chatRoom.unreadCount > 0 && (
                        <span className="text-xs text-white bg-orange-500 rounded-full px-2 py-0.5">
                          {chatRoom.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {lastMessagePreview}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {lastMessage?.createdAt
                        ? formatDistanceToNow(
                            new Date(lastMessage.createdAt),
                            { addSuffix: true, locale: ko }
                          )
                        : null}
                    </span>
                  </div>
                </Link>
              );
            })}
      </div>
    </Layout>
  );
};

export default ChatClient;
