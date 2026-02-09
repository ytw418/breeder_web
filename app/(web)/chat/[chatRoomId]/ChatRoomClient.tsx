"use client";

import Layout from "@components/features/MainLayout";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR, { useSWRConfig } from "swr";
import { differenceInMinutes, format, isSameDay, isToday, isYesterday } from "date-fns";
import { ko } from "date-fns/locale";

import SkeletonChatRoom from "@components/atoms/SkeletonChatRoom";
import Message from "@components/features/message";
import { cn } from "@libs/client/utils";

import { ChatRoomResponse } from "pages/api/chat/[chatRoomId]";
import { MessageResponse } from "pages/api/chat/[chatRoomId]/message";
import { ReadResponse } from "pages/api/chat/[chatRoomId]/read";

interface Form {
  message: string;
}

interface FileUploadUrlResponse {
  success: boolean;
  uploadURL?: string;
  id?: string;
}

interface CloudflareUploadResponse {
  success: boolean;
  result?: {
    id?: string;
  };
}

const PAGE_SIZE = 20;
const GROUP_MINUTES = 5;
type ChatMessage = NonNullable<ChatRoomResponse["chatRoom"]>["messages"][number];

const mergeMessages = (prev: ChatMessage[], incoming: ChatMessage[]) => {
  const map = new Map<number, ChatMessage>();
  for (const message of prev) {
    map.set(message.id, message);
  }
  for (const message of incoming) {
    map.set(message.id, message);
  }
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
};

const getDateDividerLabel = (date: Date) => {
  if (isToday(date)) return "오늘";
  if (isYesterday(date)) return "어제";
  return format(date, "M월 d일 EEEE", { locale: ko });
};

const isGroupedWithNext = (current: ChatMessage, next?: ChatMessage) => {
  if (!next) return false;
  if (current.user.id !== next.user.id) return false;
  const currentDate = new Date(current.createdAt);
  const nextDate = new Date(next.createdAt);
  if (!isSameDay(currentDate, nextDate)) return false;
  return Math.abs(differenceInMinutes(nextDate, currentDate)) <= GROUP_MINUTES;
};

const ChatRoomClient = () => {
  const { user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();
  const params = useParams();
  const chatRoomId = params?.chatRoomId as string;

  const [title, setTitle] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const initializedRef = useRef(false);
  const lastReadSyncKeyRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3초마다 최신 20개 폴링
  const { data, mutate, isLoading } = useSWR<ChatRoomResponse>(
    chatRoomId && `/api/chat/${chatRoomId}?limit=${PAGE_SIZE}`,
    { refreshInterval: 3000 }
  );

  // 접근 권한 없거나 에러 시 로그인 페이지로 이동
  useEffect(() => {
    if (data && !data.success) {
      router.replace("/auth/login");
    }
  }, [data, router]);

  const [sendMessage, { loading }] = useMutation<MessageResponse>(
    `/api/chat/${chatRoomId}/message`
  );

  const [markAsRead] = useMutation<ReadResponse>(
    `/api/chat/${chatRoomId}/read`
  );

  const { register, handleSubmit, reset, watch } = useForm<Form>();
  const messageText = watch("message", "");

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const loadOlderMessages = async () => {
    if (
      !chatRoomId ||
      !olderCursor ||
      !hasMoreOlder ||
      loadingOlder ||
      loadingOlderRef.current
    ) {
      return;
    }
    const container = chatContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    try {
      loadingOlderRef.current = true;
      setLoadingOlder(true);
      const res = await fetch(
        `/api/chat/${chatRoomId}?limit=${PAGE_SIZE}&beforeId=${olderCursor}`
      );
      const result: ChatRoomResponse = await res.json();
      if (!res.ok || !result.success || !result.chatRoom) return;

      const olderMessages = result.chatRoom.messages || [];
      setMessages((prev) => mergeMessages(prev, olderMessages));
      setOlderCursor(result.pagination?.nextCursor ?? null);
      setHasMoreOlder(Boolean(result.pagination?.hasMore));

      requestAnimationFrame(() => {
        if (!container) return;
        const nextScrollHeight = container.scrollHeight;
        container.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
      });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);

    if (scrollTop < 80 && hasMoreOlder && !loadingOlder) {
      loadOlderMessages();
    }
  };

  // 텍스트 메시지 전송
  const onValid = async (form: Form) => {
    const text = form.message.trim();
    if (text.length < 1 || loading || imageUploading) return;
    reset();

    sendMessage({
      data: { type: "TEXT", message: text },
      onCompleted(result) {
        if (!result?.success || !result.message) return;
        setMessages((prev) => mergeMessages(prev, [result.message!]));
        scrollToBottom();
        mutate();
      },
    });
  };

  // 이미지 메시지 전송
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imageUploading) return;

    setImageUploading(true);

    try {
      // 1. Cloudflare direct upload URL 발급
      const uploadUrlRes = await fetch("/api/files");
      const fileUploadInfo: FileUploadUrlResponse = await uploadUrlRes.json();
      const uploadURL = fileUploadInfo.uploadURL;
      const preIssuedImageId = fileUploadInfo.id;
      if (!uploadUrlRes.ok || !uploadURL) {
        throw new Error("이미지 업로드 URL 발급 실패");
      }

      // 2. Cloudflare에 이미지 업로드
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(uploadURL, { method: "POST", body: formData });
      const uploadResult: CloudflareUploadResponse = await uploadRes.json();
      if (!uploadRes.ok || !uploadResult.success) {
        throw new Error("이미지 업로드 실패");
      }
      const finalImageId = uploadResult.result?.id || preIssuedImageId;
      if (!finalImageId) {
        throw new Error("업로드된 이미지 ID를 확인할 수 없습니다.");
      }

      // 3. 서버에 이미지 메시지 전송
      sendMessage({
        data: { type: "IMAGE", image: finalImageId },
        onCompleted(result) {
          if (!result?.success || !result.message) return;
          setMessages((prev) => mergeMessages(prev, [result.message!]));
          scrollToBottom();
          mutate();
        },
      });
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
    if (!data?.success || !data.chatRoom) return;

    const incoming = data.chatRoom.messages || [];
    if (!initializedRef.current) {
      setMessages(incoming);
      setOlderCursor(data.pagination?.nextCursor ?? null);
      setHasMoreOlder(Boolean(data.pagination?.hasMore));
      initializedRef.current = true;
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    setMessages((prev) => mergeMessages(prev, incoming));
    if (isAtBottom) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [data?.chatRoom?.messages, data?.pagination, data?.success, isAtBottom]);

  // 상대방 이름을 타이틀로 설정
  useEffect(() => {
    const _title = data?.chatRoom?.chatRoomMembers.find(
      (member) => member.user.id !== user?.id
    )?.user.name;
    setTitle(_title ?? "");
  }, [data, user?.id]);

  // 메시지 목록이 갱신되면 읽음 상태를 서버에 반영해 뱃지 카운트를 동기화한다.
  useEffect(() => {
    if (!data?.chatRoom || messages.length === 0) return;
    const latestMessageId = messages[messages.length - 1]?.id;
    if (!latestMessageId) return;

    // 같은 채팅방/같은 최신 메시지 기준으로는 중복 읽음 호출을 막는다.
    const syncKey = `${data.chatRoom.id}-${latestMessageId}`;
    if (lastReadSyncKeyRef.current === syncKey) return;
    lastReadSyncKeyRef.current = syncKey;

    markAsRead({
      data: {},
      onCompleted(result) {
        if (result?.success) {
          globalMutate("/api/chat/chatList");
        }
      },
    });
  }, [messages, data?.chatRoom?.id, markAsRead, globalMutate]);

  // 같은 발신자의 연속 메시지는 아바타/시간 노출을 묶어 채팅 가독성을 높인다.
  const renderedItems = useMemo(() => {
    const items: Array<
      | { type: "divider"; key: string; label: string }
      | {
          type: "message";
          key: string;
          message: ChatMessage;
          reversed: boolean;
          showAvatar: boolean;
          showTime: boolean;
        }
    > = [];

    messages.forEach((message, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const currentDate = new Date(message.createdAt);
      const previousDate = prev ? new Date(prev.createdAt) : null;

      if (!previousDate || !isSameDay(previousDate, currentDate)) {
        items.push({
          type: "divider",
          key: `divider-${message.id}`,
          label: getDateDividerLabel(currentDate),
        });
      }

      const reversed = user?.id === message.user.id;
      const grouped = isGroupedWithNext(message, next);
      items.push({
        type: "message",
        key: `message-${message.id}`,
        message,
        reversed,
        showAvatar: !reversed && !grouped,
        showTime: !grouped,
      });
    });

    return items;
  }, [messages, user?.id]);

  if (isLoading && !initializedRef.current) {
    return (
      <Layout canGoBack title={title} seoTitle="채팅방">
        <SkeletonChatRoom />
      </Layout>
    );
  }

  return (
    <Layout canGoBack title={title} seoTitle="채팅방">
      <div className="relative h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50/70">
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3 pb-28 pt-4 sm:px-4"
        >
          <div className="mx-auto w-full max-w-2xl">
            {(hasMoreOlder || loadingOlder) && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingOlder || !hasMoreOlder}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingOlder ? "이전 메시지 불러오는 중..." : "이전 대화 보기"}
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              {renderedItems.map((item) => {
                if (item.type === "divider") {
                  return (
                    <div key={item.key} className="my-3 flex justify-center">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-400 shadow-sm">
                        {item.label}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={item.key}>
                    <Message
                      avatarUrl={item.message.user.avatar}
                      message={item.message.message}
                      type={item.message.type}
                      image={item.message.image}
                      reversed={item.reversed}
                      userId={item.message.user.id}
                      createdAt={item.message.createdAt}
                      showAvatar={item.showAvatar}
                      showTime={item.showTime}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {!isAtBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="fixed bottom-[88px] left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition-colors hover:bg-slate-800"
          >
            최신 메시지로 이동
          </button>
        )}

        {/* 메시지 입력 폼 */}
        <form
          onSubmit={handleSubmit(onValid)}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/92 backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-2xl items-end gap-2 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 sm:px-4">
            {/* 이미지 첨부 버튼 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="이미지 첨부"
            >
              {imageUploading ? (
                <svg
                  className="h-5 w-5 animate-spin text-slate-400"
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
                  className="h-5 w-5"
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
            <div className="relative flex-1">
              <input
                {...register("message")}
                type="text"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-12 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/15"
                placeholder="메시지를 입력하세요"
                required
              />
              <button
                type="submit"
                disabled={loading || imageUploading || !messageText.trim()}
                className={cn(
                  "absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-sm transition-colors",
                  loading || imageUploading || !messageText.trim()
                    ? "cursor-not-allowed bg-slate-300"
                    : "bg-slate-900 hover:bg-slate-800"
                )}
                aria-label="메시지 전송"
              >
                <svg
                  className="h-4 w-4"
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
      </div>
    </Layout>
  );
};

export default ChatRoomClient;
