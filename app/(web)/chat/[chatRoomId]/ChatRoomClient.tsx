"use client";

/**
 * 채팅방 — 앱 bredy_app src/app/chat/[chatRoomId].tsx (시안 A-karrot.html 우측 화면) 1:1.
 * 헤더(뒤로 + 상대 이름 18/700 + ⋮ 신고·차단) / 날짜 구분 / 말풍선 묶음 / "읽음" / 입력바(+ · pill · 전송).
 * 최신 메시지가 아래, 이전 대화는 맨 위 "이전 대화 보기". 상품 맥락 바는 서버가 상품을 주지 않아 그리지 않는다.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import SkeletonChatRoom from "@components/atoms/SkeletonChatRoom";
import ChatMessageGroup from "@components/features/message";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useBlocks } from "hooks/useBlocks";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";

import type { ChatRoomResponse } from "pages/api/chat/[chatRoomId]";
import type { MessageResponse } from "pages/api/chat/[chatRoomId]/message";
import type { ReadResponse } from "pages/api/chat/[chatRoomId]/read";
import {
  CHAT_PAGE_SIZE,
  CHAT_ROOM_POLL_MS,
  buildChatItems,
  composerPlaceholder,
  findPartner,
  findReadReceiptMessageId,
  formatChatTime,
  imageUploadNotices,
  isDeletedPartnerName,
  mergeMessages,
  olderMessagesCursor,
  planImageUploads,
} from "../chatFormat";
import { BackIcon, ChatCenterNotice, MoreIcon, PlusIcon, SendIcon } from "../chatUi";

type ChatMessage = NonNullable<ChatRoomResponse["chatRoom"]>["messages"][number];

/** 입력창이 늘어나는 최대 높이(15px 글자 약 5줄). 넘으면 입력창 안에서 스크롤. */
const COMPOSER_MAX_HEIGHT = 112;
/** 바닥에서 이 거리 안이면 새 메시지가 올 때 아래로 따라간다. */
const STICK_TO_BOTTOM_PX = 80;

type MessageResult = MessageResponse & { status?: number; errorCode?: string };

async function uploadChatImage(file: File): Promise<string> {
  const urlRes = await authFetch("/api/files");
  const info = (await urlRes.json().catch(() => null)) as { uploadURL?: string; id?: string } | null;
  if (!urlRes.ok || !info?.uploadURL) throw new Error("이미지 업로드에 실패했습니다.");
  const form = new FormData();
  form.append("file", file);
  const uploaded = await fetch(info.uploadURL, { method: "POST", body: form });
  const payload = (await uploaded.json().catch(() => null)) as { result?: { id?: string } } | null;
  const imageId = payload?.result?.id || info.id || "";
  if (!uploaded.ok || !imageId) throw new Error("이미지 업로드에 실패했습니다.");
  return imageId;
}

function RoomHeader({ title, onBack, onMore }: { title: string; onBack: () => void; onMore?: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-app-line bg-app-bg px-4 text-app-text">
      <button type="button" onClick={onBack} aria-label="뒤로 가기" className="-m-2.5 grid shrink-0 place-items-center p-2.5">
        <BackIcon />
      </button>
      <h1 className="min-w-0 truncate text-[18px] font-bold tracking-[-0.3px] text-app-text">{title}</h1>
      <div className="flex-1" />
      {onMore ? (
        <button
          type="button"
          onClick={onMore}
          aria-label="더보기"
          className="-m-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-app-surface"
        >
          <MoreIcon />
        </button>
      ) : (
        // 시안의 ⋮ 자리. 상대가 없거나 탈퇴해 동작이 없으면 보조기기에서는 숨긴다.
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center">
          <MoreIcon />
        </span>
      )}
    </header>
  );
}

const ChatRoomClient = () => {
  const { user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();
  const params = useParams();
  const roomId = params?.chatRoomId as string | undefined;

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [olderPagination, setOlderPagination] = useState<{ nextCursor: number | null; hasMore: boolean } | null>(
    null
  );
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [viewerImageId, setViewerImageId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ id: number; name: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const forceBottomRef = useRef(false);
  const initialScrolledRef = useRef(false);
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  const lastIdRef = useRef<number | null>(null);
  const latestReadKeyRef = useRef<string | null>(null);

  const { isBlocked, unblock } = useBlocks();

  const { data, error, isLoading, mutate } = useSWR<ChatRoomResponse>(
    roomId ? `/api/chat/${roomId}?limit=${CHAT_PAGE_SIZE}` : null,
    { refreshInterval: CHAT_ROOM_POLL_MS }
  );

  const [sendMessage, { loading: sending }] = useMutation<MessageResult>(`/api/chat/${roomId}/message`);
  const [markAsRead] = useMutation<ReadResponse>(`/api/chat/${roomId}/read`);

  const serverMessages = useMemo(() => data?.chatRoom?.messages ?? [], [data?.chatRoom?.messages]);
  // 폴링은 최신 20개만 준다. 받은 것을 계속 쌓아 두어야 창에서 밀려난 메시지가 사라지지 않는다.
  useEffect(() => {
    if (serverMessages.length === 0) return;
    setLocalMessages((prev) => mergeMessages(prev, serverMessages));
  }, [serverMessages]);
  const messages = useMemo(() => mergeMessages(localMessages, serverMessages), [localMessages, serverMessages]);

  const hasMoreOlder = Boolean((olderPagination ?? data?.pagination)?.hasMore);
  // 커서는 화면에 있는 가장 오래된 메시지. 첫 응답 이후 쌓인 메시지를 건너뛰지 않는다.
  const olderCursor = olderMessagesCursor(messages, hasMoreOlder);

  const room = data?.chatRoom;
  const otherMember = room ? findPartner(room.chatRoomMembers, user?.id) : undefined;
  const partner = otherMember?.user;
  const title = partner?.name || "채팅방";
  const partnerBlocked = Boolean(partner && isBlocked(partner.id));
  // 방은 불러왔는데 상대 멤버가 없는 방(예전 하드 삭제)도 서버가 탈퇴로 403 을 준다.
  const partnerDeleted = Boolean(room) && (!partner || isDeletedPartnerName(partner.name));
  const composerLocked = partnerDeleted || partnerBlocked;
  const canModerate = Boolean(partner && !partnerDeleted);

  const readReceiptMessageId = useMemo(
    () => findReadReceiptMessageId(messages, otherMember?.lastReadAt, user?.id),
    [messages, otherMember?.lastReadAt, user?.id]
  );
  const items = useMemo(() => buildChatItems(messages, user?.id), [messages, user?.id]);

  // 읽음 처리: 최신 메시지가 바뀔 때마다 1회(목록·탭 뱃지 갱신)
  useEffect(() => {
    const latestId = messages[messages.length - 1]?.id;
    if (!room || !latestId) return;
    const key = `${room.id}-${latestId}`;
    if (latestReadKeyRef.current === key) return;
    latestReadKeyRef.current = key;
    markAsRead({
      data: {},
      onCompleted(result) {
        if (!result?.success) return;
        void globalMutate("/api/chat/chatList");
        void globalMutate("/api/chat/unread-count");
      },
    }).catch(() => undefined);
  }, [messages, room, markAsRead, globalMutate]);

  // 스크롤: 처음엔 맨 아래, 이전 대화를 붙이면 보던 위치 유지, 새 메시지는 바닥 근처일 때만 따라간다.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    const lastId = messages[messages.length - 1].id;
    if (restoreRef.current) {
      el.scrollTop = el.scrollHeight - restoreRef.current.height + restoreRef.current.top;
      restoreRef.current = null;
    } else if (!initialScrolledRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrolledRef.current = true;
    } else if (lastId !== lastIdRef.current && (atBottomRef.current || forceBottomRef.current)) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    forceBottomRef.current = false;
    lastIdRef.current = lastId;
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
  };

  const loadOlder = async () => {
    if (!roomId || !olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await authFetch(`/api/chat/${roomId}?limit=${CHAT_PAGE_SIZE}&beforeId=${olderCursor}`);
      const result = (await res.json().catch(() => null)) as ChatRoomResponse | null;
      if (!res.ok || !result?.success || !result.chatRoom) return;
      const el = scrollRef.current;
      restoreRef.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
      setLocalMessages((prev) => mergeMessages(prev, result.chatRoom!.messages));
      setOlderPagination({
        nextCursor: result.pagination?.nextCursor ?? null,
        hasMore: Boolean(result.pagination?.hasMore),
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, []);

  useLayoutEffect(() => {
    resizeComposer();
  }, [text, composerLocked, resizeComposer]);

  const canSend = Boolean(text.trim()) && !composerLocked && !sending && !imageUploading;

  const submitText = async () => {
    const value = text.trim();
    if (!value || composerLocked || sending || imageUploading) return;
    // 누르는 즉시 입력창을 비운다. 실패하면 되돌린다(그사이 새로 입력했으면 유지).
    setText("");
    try {
      const result = await sendMessage({ data: { type: "TEXT", message: value } });
      if (!result?.success || !result.message) {
        setText((prev) => prev || value);
        // 차단·탈퇴 상대(403)는 서버 문구를 그대로 보여준다.
        toast.error(result?.error || "메시지 전송에 실패했습니다.");
        return;
      }
      forceBottomRef.current = true;
      setLocalMessages((prev) => mergeMessages(prev, [result.message!]));
      void mutate();
      void globalMutate("/api/chat/chatList");
    } catch {
      setText((prev) => prev || value);
      toast.error("메시지 전송에 실패했습니다.");
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!roomId || files.length === 0 || imageUploading || composerLocked) return;

    const { toSend, summary } = planImageUploads(files);
    setImageUploading(true);
    try {
      // 장마다 IMAGE 메시지 1개씩 순차 전송. 한 장이 실패해도 나머지는 계속 보낸다.
      for (let index = 0; index < toSend.length; index += 1) {
        const file = toSend[index];
        try {
          const imageId = await uploadChatImage(file);
          const sent = await sendMessage({ data: { type: "IMAGE", image: imageId } });
          if (!sent?.success || !sent.message) {
            summary.failed += 1;
            if (sent?.error) summary.serverError = sent.error;
            // 차단·탈퇴 상대(403)에게는 남은 사진도 보낼 수 없으니 멈춘다.
            if (sent?.status === 403) {
              summary.failed += toSend.length - index - 1;
              break;
            }
            continue;
          }
          summary.sent += 1;
          forceBottomRef.current = true;
          setLocalMessages((prev) => mergeMessages(prev, [sent.message!]));
        } catch {
          summary.failed += 1;
        }
      }
    } finally {
      setImageUploading(false);
    }

    if (summary.sent > 0) {
      void mutate();
      void globalMutate("/api/chat/chatList");
    }
    const notices = imageUploadNotices(summary);
    if (notices.length > 0) {
      toast.error("이미지 업로드", {
        description: <span className="whitespace-pre-line">{notices.join("\n")}</span>,
      });
    }
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/chat");
  };

  const sheetActions: ActionSheetAction[] = partner
    ? [
        { key: "report", label: "신고하기", onSelect: () => setReportOpen(true) },
        partnerBlocked
          ? { key: "unblock", label: "차단 해제", onSelect: () => void unblock(partner.id) }
          : {
              key: "block",
              label: "차단하기",
              destructive: true,
              onSelect: () => setBlockTarget({ id: partner.id, name: partner.name }),
            },
      ]
    : [];

  const isError = (Boolean(error) && !data) || (data ? !data.success : false);
  const isRoomLoading = isLoading && !data;

  return (
    <div className="fixed inset-0 flex justify-center bg-app-bg">
      <div className="flex h-full w-full max-w-xl flex-col bg-app-bg">
        {isError ? (
          <>
            <RoomHeader title="채팅방" onBack={goBack} />
            <ChatCenterNotice
              title={data?.error || (error instanceof Error ? error.message : "") || "채팅방을 불러오지 못했습니다."}
              description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
              action={{ label: "다시 시도", onClick: () => void mutate() }}
            />
          </>
        ) : (
          <>
            <RoomHeader title={title} onBack={goBack} onMore={canModerate ? () => setSheetOpen(true) : undefined} />

            <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {isRoomLoading ? (
                <SkeletonChatRoom />
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-[14px] text-app-muted">아직 대화가 없습니다.</p>
                </div>
              ) : (
                <div className="px-4 pb-2 pt-4">
                  {hasMoreOlder || loadingOlder ? (
                    <div className="mb-3 flex justify-center">
                      <button
                        type="button"
                        onClick={() => void loadOlder()}
                        disabled={loadingOlder || !hasMoreOlder}
                        className="h-8 rounded-2xl bg-app-surface px-3.5 text-[13px] font-semibold text-app-sub disabled:opacity-60"
                      >
                        {loadingOlder ? "불러오는 중" : "이전 대화 보기"}
                      </button>
                    </div>
                  ) : null}
                  {items.map((item) => {
                    if (item.type === "divider") {
                      return (
                        <p key={item.key} className="mb-4 mt-1.5 text-center text-[13px] text-app-muted">
                          {item.label}
                        </p>
                      );
                    }
                    const last = item.messages[item.messages.length - 1];
                    return (
                      <ChatMessageGroup
                        key={item.key}
                        messages={item.messages}
                        mine={item.mine}
                        avatar={item.avatar}
                        timeLabel={formatChatTime(last?.createdAt)}
                        showReadReceipt={item.mine && readReceiptMessageId != null && last?.id === readReceiptMessageId}
                        onOpenImage={setViewerImageId}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 입력바: + 36 원형 · pill h40 r20 · 전송 28 원형 주황. 여러 줄이면 위로 늘어난다. */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitText();
              }}
              className="flex shrink-0 items-end gap-2 border-t border-app-line bg-app-bg px-3 pb-[max(20px,calc(env(safe-area-inset-bottom)+8px))] pt-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading || composerLocked}
                aria-label="사진 보내기"
                className={cn(
                  "mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-app-surface text-app-sub",
                  imageUploading && "opacity-60"
                )}
              >
                {imageUploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-app-caption border-t-transparent" />
                ) : (
                  <PlusIcon />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void handleFiles(event.target.files)}
              />

              <div className="flex min-h-[40px] flex-1 items-end rounded-[20px] bg-app-surface pl-4 pr-2">
                {/* 차단·탈퇴 상대면 안내 placeholder 가 보이게 비워 둔다(차단 해제하면 입력하던 글이 돌아온다). */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={composerLocked ? "" : text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void submitText();
                    }
                  }}
                  disabled={composerLocked}
                  placeholder={composerPlaceholder({ deleted: partnerDeleted, blocked: partnerBlocked })}
                  aria-label="메시지 입력"
                  className="max-h-[112px] min-h-[40px] flex-1 resize-none border-0 bg-transparent p-0 py-2.5 text-[15px] leading-5 text-app-text outline-none placeholder:text-app-caption focus:ring-0 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="메시지 전송"
                  className={cn(
                    "mb-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-app-brand text-white",
                    !canSend && "opacity-40"
                  )}
                >
                  <SendIcon />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <ImageLightbox
        images={viewerImageId ? [makeImageUrl(viewerImageId, "public")] : []}
        isOpen={Boolean(viewerImageId)}
        currentIndex={0}
        onClose={() => setViewerImageId(null)}
        onIndexChange={() => undefined}
        altPrefix="채팅 이미지"
      />
      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} actions={sheetActions} />
      <ReportSheet
        open={reportOpen}
        targetType="CHAT_ROOM"
        targetId={room?.id ?? null}
        onClose={() => setReportOpen(false)}
      />
      <BlockConfirmDialog target={blockTarget} onClose={() => setBlockTarget(null)} />
    </div>
  );
};

export default ChatRoomClient;
