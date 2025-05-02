"use client";

import Layout from "@components/features/MainLayout";

import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { produce } from "immer";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";

import SkeletonChatRoom from "@components/atoms/SkeletonChatRoom";
import Message from "@components/features/message";
import { makeImageUrl } from "@libs/client/utils";

import Link from "next/link";
import { ChatRoomResponse } from "pages/api/chat/[chatRoomId]";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSWRConfig } from "swr";
import Image from "@components/atoms/Image";

interface Form {
  message: string;
}

interface ReadResponse {
  success: boolean;
  error?: string;
  unreadCount?: number;
  lastReadAt?: Date;
}

const ChatRoomClient = () => {
  const { user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const params = useParams();
  const chatRoomId = params?.chatRoomId as string;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [title, setTitle] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { data, mutate, isLoading } = useSWR<ChatRoomResponse>(
    chatRoomId && `/api/chat/${chatRoomId}`
  );

  const [sendMessage, { loading, data: sendMessageData }] = useMutation(
    `/api/chat/${chatRoomId}/message`
  );

  const [markAsRead] = useMutation<ReadResponse>(
    `/api/chat/${chatRoomId}/read`
  );

  const { register, handleSubmit, reset } = useForm<Form>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
    }
  };

  const onValid = async (form: Form) => {
    if (form.message.length < 1) return;
    reset();
    await mutate(
      (prev) =>
        prev &&
        produce(prev, (drift) => {
          drift.chatRoom?.messages.push({
            id: Date.now(),
            message: form.message,
            createdAt: new Date().toISOString(),
            user: {
              id: user?.id!,
              name: user?.name!,
              avatar: user?.avatar || null,
            },
          });
        }),
      false
    );
    scrollToBottom();
    sendMessage({ data: form });
  };

  useEffect(() => {
    if (sendMessageData && sendMessageData.success) {
      scrollToBottom();
    }
  }, [sendMessageData]);

  useEffect(() => {
    scrollToBottom();
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    const _title = data?.chatRoom?.chatRoomMembers.find(
      (member) => member.user.id !== user?.id
    )?.user.name;
    setTitle(_title ?? "");
  }, [data, user?.id]);

  useEffect(() => {
    if (data?.chatRoom) {
      markAsRead({
        data: {},
        onCompleted(result) {
          if (result?.success) {
            globalMutate("/api/chat/chatList");
          }
        },
      });
    }
  }, [data?.chatRoom?.messages.length]);

  const otherUser = data?.chatRoom?.chatRoomMembers.find(
    (member) => member.userId !== user?.id
  )?.user;

  const isBuyer =
    data?.chatRoom?.type === "product"
      ? data.chatRoom.product?.user?.id === user?.id
        ? false // 현재 사용자가 상품 소유자면 판매자
        : true // 현재 사용자가 상품 소유자가 아니면 구매자
      : false;

  const getTransactionStatus = () => {
    if (!data?.chatRoom) return "";

    if (data.chatRoom.isCompleted) {
      return "거래가 완료되었습니다.";
    }

    if (isBuyer) {
      //판매자만 확정하고 구매자는 확정하지 않았을떄
      if (data.chatRoom.buyerConfirmed) {
        return "구매 확정을 완료했습니다. 판매자가 판매를 확정하면 거래가 완료됩니다.";
      }
      if (data.chatRoom.sellerConfirmed) {
        return "판매자가 판매를 확정했습니다. 구매확정을 클릭하면 거래가 완료됩니다.";
      }

      return "구매를 확정 하시겠습니까?";
    } else {
      if (data.chatRoom.sellerConfirmed) {
        return "판매 확정을 완료했습니다. 구매자가 구매를 확정하면 거래가 완료됩니다.";
      }
      if (data.chatRoom.buyerConfirmed) {
        return "구매자가 구매를 확정했습니다. 판매확정을 클릭하면 거래가 완료됩니다.";
      }
      return "판매를 확정 하시겠습니까?";
    }
  };

  const getConfirmDialogMessage = () => {
    if (!data?.chatRoom) return "";

    if (isBuyer) {
      if (data.chatRoom.sellerConfirmed) {
        return "판매자가 판매를 확정했습니다. 구매확정을 클릭하면 거래가 완료됩니다. 정말 구매를 확정하시겠습니까?";
      }
      return "정말 구매를 확정하시겠습니까? 확정 후에는 취소할 수 없습니다.";
    } else {
      if (data.chatRoom.buyerConfirmed) {
        return "구매자가 구매를 확정했습니다. 판매확정을 클릭하면 거래가 완료됩니다. 정말 판매를 확정하시겠습니까?";
      }
      return "정말 판매를 확정하시겠습니까? 확정 후에는 취소할 수 없습니다.";
    }
  };

  const handleConfirm = async () => {
    try {
      const response = await fetch(`/api/chat/${chatRoomId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isBuyer,
        }),
      });

      const data = await response.json();

      if (data.success) {
        globalMutate(`/api/chat/${chatRoomId}`);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error confirming transaction:", error);
      alert("거래 확정에 실패했습니다.");
    }
    setShowConfirmDialog(false);
  };

  if (isLoading) {
    return (
      <Layout canGoBack title={title} seoTitle={"채팅방"}>
        <SkeletonChatRoom />
      </Layout>
    );
  }

  return (
    <Layout canGoBack title={title} seoTitle={"채팅방"}>
      <div className="px-4 py-4">
        {data?.chatRoom?.type === "product" && data?.chatRoom?.product && (
          <div className="flex gap-4 items-center">
            <Link
              href={`/products/${data.chatRoom.product.id}`}
              className="flex items-center gap-4"
            >
              <div className="relative w-20 h-20">
                <Image
                  src={makeImageUrl(data.chatRoom.product.photos[0], "product")}
                  alt={data.chatRoom.product.name}
                  className="object-cover rounded-md"
                  fill={true}
                  sizes="100%"
                />
              </div>
              <div className="flex flex-col">
                <h3 className="font-semibold">{data.chatRoom.product.name}</h3>
                <p className="text-sm text-gray-500">
                  {data.chatRoom.product.price
                    ? `${data.chatRoom.product.price.toLocaleString()}원`
                    : "가격 미정"}
                </p>
              </div>
            </Link>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {getTransactionStatus()}
                </p>
                {!data.chatRoom.isCompleted && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={
                      (isBuyer && data.chatRoom.buyerConfirmed) ||
                      (!isBuyer && data.chatRoom.sellerConfirmed)
                    }
                    className={`px-3 py-1 text-sm rounded-md ${
                      (isBuyer && data.chatRoom.buyerConfirmed) ||
                      (!isBuyer && data.chatRoom.sellerConfirmed)
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-orange-500 text-white hover:bg-orange-600"
                    }`}
                  >
                    {isBuyer ? "구매 확정" : "판매 확정"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        ref={chatContainerRef}
        className="py-4 pb-24 px-4 space-y-4 overflow-y-auto h-[calc(100vh-8rem)]"
      >
        {data?.chatRoom?.messages?.map((message) => (
          <Message
            key={message.id}
            avatarUrl={message.user.avatar}
            message={message.message}
            reversed={user?.id === message.user.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit(onValid)}
        className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-sm border-t border-gray-100"
      >
        <div className="flex relative items-center w-full max-w-xl mx-auto px-4 py-3">
          <input
            {...register("message")}
            type="text"
            className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="메시지를 입력하세요"
            required
          />
          <button
            type="submit"
            className="absolute right-6 flex items-center justify-center w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 5l7 7-7 7M5 12h14"
              />
            </svg>
          </button>
        </div>
      </form>

      {showConfirmDialog && data?.chatRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {isBuyer ? "구매 확정" : "판매 확정"}
            </h3>
            <p className="text-gray-600 mb-6">{getConfirmDialogMessage()}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-md"
              >
                확정
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </Layout>
  );
};

export default ChatRoomClient;
