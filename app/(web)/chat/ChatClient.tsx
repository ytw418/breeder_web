"use client";

import { useMemo, useState } from "react";
import Layout from "@components/features/MainLayout";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import useUser from "hooks/useUser";
import { cn, makeImageUrl } from "@libs/client/utils";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import SkeletonChat from "@components/atoms/SkeletonChat";
import { ChatListResponse } from "pages/api/chat/chatList";

type ChatFilter = "all" | "unread";

const getLastMessagePreview = (
  message: ChatListResponse["chatRooms"][number]["lastMessage"]
) => {
  if (!message) return "아직 대화가 없습니다.";
  if (message.type === "IMAGE") return "사진을 보냈습니다";
  return message.message;
};

const ChatClient = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");

  // 채팅방 목록은 최근 대화를 기준으로 짧은 주기로 동기화
  const { data, isLoading } = useSWR<ChatListResponse>("/api/chat/chatList", {
    refreshInterval: 5000,
  });
  const { user } = useUser();

  const chatRooms = data?.chatRooms || [];

  const filteredChatRooms = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return chatRooms.filter((chatRoom) => {
      const otherUser = chatRoom.chatRoomMembers.find(
        (member) => member.user.id !== user?.id
      )?.user;

      const matchKeyword = keyword
        ? Boolean(otherUser?.name?.toLowerCase().includes(keyword))
        : true;
      const matchFilter = filter === "unread" ? chatRoom.unreadCount > 0 : true;

      return matchKeyword && matchFilter;
    });
  }, [chatRooms, filter, searchKeyword, user?.id]);

  return (
    <Layout icon hasTabBar title="채팅" seoTitle="채팅">
      <div className="pb-20">
        <section className="sticky top-14 z-20 border-y border-slate-100 bg-white/90 px-4 py-2 backdrop-blur">
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="대화 상대 검색"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/15"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-200 p-1 text-slate-600 transition-colors hover:bg-slate-300"
                aria-label="검색어 지우기"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold transition-all",
                filter === "all"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:text-slate-800"
              )}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold transition-all",
                filter === "unread"
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:text-slate-800"
              )}
            >
              안 읽음
            </button>
          </div>
        </section>

        <section className="mt-2">
          {isLoading ? (
            <div className="space-y-2 px-3">
              {[...Array(8)].map((_, index) => (
                <SkeletonChat key={index} />
              ))}
            </div>
          ) : filteredChatRooms.length > 0 ? (
            <div className="space-y-2 px-3">
              {filteredChatRooms.map((chatRoom) => {
                const otherUser = chatRoom.chatRoomMembers.find(
                  (member) => member.user.id !== user?.id
                )?.user;
                const lastMessage = chatRoom.lastMessage;
                const previewText = getLastMessagePreview(lastMessage);
                const isMineLastMessage = lastMessage?.userId === user?.id;

                return (
                  <Link
                    key={chatRoom.id}
                    href={`/chat/${chatRoom.id}`}
                    className={cn(
                      "block rounded-2xl border bg-white px-3.5 py-3.5 shadow-sm transition-all",
                      chatRoom.unreadCount > 0
                        ? "border-emerald-200 hover:border-emerald-300 hover:shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        {otherUser?.avatar ? (
                          <Image
                            width={48}
                            height={48}
                            src={makeImageUrl(otherUser.avatar, "avatar")}
                            className="h-12 w-12 rounded-full bg-slate-200 ring-1 ring-slate-200"
                            alt="프로필"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-slate-200 ring-1 ring-slate-200" />
                        )}
                        {chatRoom.unreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {otherUser?.name || "알 수 없음"}
                          </p>
                          <span className="flex-shrink-0 text-[11px] text-slate-400">
                            {lastMessage?.createdAt
                              ? formatDistanceToNow(new Date(lastMessage.createdAt), {
                                  addSuffix: true,
                                  locale: ko,
                                })
                              : ""}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-slate-500">
                            {isMineLastMessage ? "나: " : ""}
                            {previewText}
                          </p>
                          {chatRoom.unreadCount > 0 && (
                            <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                              {chatRoom.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-16 text-center">
              <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold text-slate-700">
                  {searchKeyword ? "검색 결과가 없습니다." : "아직 대화가 없습니다."}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  상품 또는 프로필에서 먼저 대화를 시작해보세요.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default ChatClient;
