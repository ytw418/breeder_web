"use client";

import { useState } from "react";
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
  const [searchKeyword, setSearchKeyword] = useState("");

  // 5초마다 채팅 목록 새로고침
  const { data, isLoading } = useSWR<ChatListResponse>("/api/chat/chatList", {
    refreshInterval: 5000,
  });
  const { user } = useUser();

  // 검색어로 채팅방 필터링 (상대방 이름 기준)
  const filteredChatRooms = data?.chatRooms?.filter((chatRoom) => {
    if (!searchKeyword.trim()) return true;
    const otherUser = chatRoom.chatRoomMembers.find(
      (member) => member.user.id !== user?.id
    )?.user;
    return otherUser?.name
      ?.toLowerCase()
      .includes(searchKeyword.trim().toLowerCase());
  });

  return (
    <Layout icon hasTabBar title="채팅" seoTitle="채팅">
      {/* 검색 입력 */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="대화 상대 검색"
            className="w-full px-4 py-2.5 pl-10 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-gray-300 hover:bg-gray-400 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="divide-y-[1px]">
        {isLoading
          ? [...Array(10)].map((_, index) => <SkeletonChat key={index} />)
          : filteredChatRooms?.map((chatRoom) => {
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

        {/* 검색 결과 없음 */}
        {!isLoading &&
          searchKeyword.trim() &&
          filteredChatRooms?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-sm font-medium">검색 결과가 없습니다</p>
            </div>
          )}
      </div>
    </Layout>
  );
};

export default ChatClient;
