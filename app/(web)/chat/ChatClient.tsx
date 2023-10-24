"use client";

import Layout from "@components/layout";
import useSWR from "swr";
import { Message, Product, TalkToSeller } from "@prisma/client";
import Image from "next/image";
import useUser from "@libs/client/useUser";
import { findChatMember, makeImageUrl } from "@libs/client/utils";
import Link from "next/link";
import { ChatListResponseType } from "pages/api/chat/chatList";
import { useEffect } from "react";

const ChatClient = () => {
  const { data } = useSWR<ChatListResponseType>(`/api/chat/chatList`);
  const { user } = useUser();

  return (
    <Layout hasTabBar title="채팅v2" seoTitle="채팅">
      <div className="divide-y-[1px] ">
        {data?.AllChats?.map((chat, index) => (
          <Link
            key={index}
            className="flex px-4 cursor-pointer py-3 items-center space-x-3"
            href={`/chat/${chat.id}?title=${findChatMember(
              chat.chatRoomMembers,
              user?.id!
            )?.user.name}`}
          >
            <Image
              alt={`${findChatMember(chat.chatRoomMembers, user?.id!)?.user
                .id}`}
              width={50}
              height={50}
              src={makeImageUrl(
                findChatMember(chat.chatRoomMembers, user?.id!)?.user.avatar ??
                  "",
                "public"
              )}
              className="w-12 h-12 rounded-full bg-slate-300"
            />
            <div>
              <p className="text-gray-700">
                {findChatMember(chat.chatRoomMembers, user?.id!)?.user.name ??
                  "대화상대가 존재하지 않습니다."}
              </p>
              <p className="text-sm  text-gray-500">
                {chat.messages.slice(-1).map((message) => message.message)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
};

export default ChatClient;
