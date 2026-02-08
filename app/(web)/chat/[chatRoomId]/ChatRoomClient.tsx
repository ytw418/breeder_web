"use client";

import Layout from "@components/features/MainLayout";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { produce } from "immer";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR, { useSWRConfig } from "swr";

import SkeletonChatRoom from "@components/atoms/SkeletonChatRoom";
import Message from "@components/features/message";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";

import { ChatRoomResponse } from "pages/api/chat/[chatRoomId]";
import { ReadResponse } from "pages/api/chat/[chatRoomId]/read";

interface Form {
  message: string;
}

const ChatRoomClient = () => {
  const { user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();
  const params = useParams();
  const chatRoomId = params?.chatRoomId as string;

  const [title, setTitle] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3초마다 새 메시지 폴링
  const { data, mutate, isLoading } = useSWR<ChatRoomResponse>(
    chatRoomId && `/api/chat/${chatRoomId}`,
    { refreshInterval: 3000 }
  );

  // 접근 권한 없거나 에러 시 로그인 페이지로 이동
  useEffect(() => {
    if (data && !data.success) {
      router.replace("/auth/login");
    }
  }, [data, router]);

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

  // 텍스트 메시지 전송
  const onValid = async (form: Form) => {
    if (form.message.length < 1 || loading) return;
    reset();

    // 낙관적 업데이트
    await mutate(
      (prev) =>
        prev &&
        produce(prev, (draft) => {
          draft.chatRoom?.messages.push({
            id: Date.now(),
            type: "TEXT",
            message: form.message,
            image: null,
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
    sendMessage({ data: { type: "TEXT", message: form.message } });
  };

  // 이미지 메시지 전송
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imageUploading) return;

    setImageUploading(true);

    try {
      // 1. Cloudflare direct upload URL 발급
      const uploadUrlRes = await fetch("/api/files");
      const { uploadURL, id: imageId } = await uploadUrlRes.json();

      // 2. Cloudflare에 이미지 업로드
      const formData = new FormData();
      formData.append("file", file);
      await fetch(uploadURL, { method: "POST", body: formData });

      // 3. 낙관적 업데이트로 이미지 미리 표시
      await mutate(
        (prev) =>
          prev &&
          produce(prev, (draft) => {
            draft.chatRoom?.messages.push({
              id: Date.now(),
              type: "IMAGE",
              message: "사진을 보냈습니다.",
              image: imageId,
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

      // 4. 서버에 이미지 메시지 전송
      sendMessage({ data: { type: "IMAGE", image: imageId } });
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      alert("이미지 업로드에 실패했습니다.");
    } finally {
      setImageUploading(false);
      // 파일 인풋 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

  // 상대방 이름을 타이틀로 설정
  useEffect(() => {
    const _title = data?.chatRoom?.chatRoomMembers.find(
      (member) => member.user.id !== user?.id
    )?.user.name;
    setTitle(_title ?? "");
  }, [data, user?.id]);

  // 메시지 읽음 처리
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

  if (isLoading) {
    return (
      <Layout canGoBack title={title} seoTitle="채팅방">
        <SkeletonChatRoom />
      </Layout>
    );
  }

  return (
    <Layout canGoBack title={title} seoTitle="채팅방">
      <div
        ref={chatContainerRef}
        className="py-4 pb-24 px-4 space-y-4 overflow-y-auto h-[calc(100vh-4rem)]"
      >
        {data?.chatRoom?.messages?.map((message) => (
          <Message
            key={message.id}
            avatarUrl={message.user.avatar}
            message={message.message}
            type={message.type}
            image={message.image}
            reversed={user?.id === message.user.id}
            userId={message.user.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 폼 */}
      <form
        onSubmit={handleSubmit(onValid)}
        className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-sm border-t border-gray-100"
      >
        <div className="flex relative items-center w-full max-w-xl mx-auto px-4 py-3 gap-2">
          {/* 이미지 첨부 버튼 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
            aria-label="이미지 첨부"
          >
            {imageUploading ? (
              <svg
                className="w-5 h-5 animate-spin text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* 텍스트 입력 */}
          <div className="flex-1 relative">
            <input
              {...register("message")}
              type="text"
              className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="메시지를 입력하세요"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors shadow-sm"
              aria-label="메시지 전송"
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
        </div>
      </form>
    </Layout>
  );
};

export default ChatRoomClient;
