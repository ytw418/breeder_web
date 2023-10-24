"use client";

import Layout from "@components/layout";
import Message from "@components/message";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import useMutation from "@libs/client/useMutation";
import useUser from "@libs/client/useUser";
import { useEffect, useRef } from "react";
import { ChatRoomResponseType } from "pages/api/chat/[chatRoomId]";
import { produce } from "immer";

interface Form {
  message: string;
}

const ChatRoomClient = () => {
  const { user } = useUser();

  const query = useParams();

  const { data, mutate } = useSWR<ChatRoomResponseType>(
    query?.chatRoomId && `/api/chat/${query?.chatRoomId}`
  );

  const [sendMessage, { loading, data: sendMessageData }] = useMutation(
    `/api/chat/${query?.chatRoomId}/message`
  );
  const { register, handleSubmit, reset } = useForm<Form>();
  const onValid = async (form: Form) => {
    if (form.message.length < 1) return;
    reset();
    // if (loading) return;
    await mutate(
      (prev) =>
        prev &&
        produce(prev, (drift) => {
          drift.chatRoom?.messages.push({
            id: Date.now(),
            createdAt: Date.now() as unknown as Date,
            updatedAt: Date.now() as unknown as Date,
            userId: user?.id!,
            message: form.message,
            chatRoomId: null,
            talktosellerId: null,
            user: { name: user?.name!, avatar: user?.avatar! },
          });
        }),
      false
    );
    scrollRef?.current?.scrollIntoView();

    sendMessage({ data: form });
    reset();
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sendMessageData && sendMessageData.success) {
      scrollRef?.current?.scrollIntoView();
    }
  }, [sendMessageData, mutate]);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView();
  }, [data]);

  return (
    <Layout canGoBack title="채팅" seoTitle="채팅">
      <div className="py-14 pb-16 px-4 space-y-4">
        {data?.chatRoom?.messages?.map((message, index) => (
          <Message
            key={index}
            avatarUrl={message.user.avatar}
            message={message.message}
            reversed={user?.id === message.userId ? true : false}
          />
        ))}

        <form
          onSubmit={handleSubmit(onValid)}
          className="fixed bottom-0 inset-x-0"
        >
          <div className="flex relative items-center w-full mx-auto border-y border-Gray-300">
            <input
              {...register("message")}
              type="text"
              className="w-full border-gray-300 pr-12 pl-4 h-[40px]"
              required
            />
            <div className="absolute inset-y-0 flex py-1.5 pr-1.5 right-0">
              <button className="flex items-center bg-orange-500 rounded-full px-3 hover:bg-orange-600 text-sm text-white">
                &rarr;
              </button>
            </div>
          </div>
        </form>
        <div ref={scrollRef} />
      </div>
    </Layout>
  );
};

export default ChatRoomClient;
