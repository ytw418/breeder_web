"use client";

/**
 * 채팅 목록 — 앱 bredy_app src/app/(tabs)/chat.tsx (시안 A-karrot.html 좌측 화면) 1:1.
 * 헤더 "채팅" 좌측 + 검색 토글 + 알림 벨 / 전체·안 읽음 칩 / 행(44 아바타·이름·시간·미리보기·주황 unread 뱃지).
 * 상품 썸네일은 서버가 방에 상품을 주지 않아 앱처럼 그리지 않는다.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import SkeletonChat from "@components/atoms/SkeletonChat";
import { FilterChip } from "@components/app/FilterChip";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import useUser from "hooks/useUser";
import { makeImageUrl } from "@libs/client/utils";
import type { ChatListResponse } from "pages/api/chat/chatList";
import {
  CHAT_LIST_POLL_MS,
  chatListEmptyMessage,
  chatPreview,
  filterChatRooms,
  findPartner,
  formatChatListTime,
  type ChatFilter,
} from "./chatFormat";
import { ChatCenterNotice, PersonIcon, SearchIcon } from "./chatUi";

type ChatRoomItem = ChatListResponse["chatRooms"][number];

function ChatRow({ room, myId }: { room: ChatRoomItem; myId?: number }) {
  const other = findPartner(room.chatRoomMembers, myId)?.user;
  const last = room.lastMessage;
  const mine = Boolean(last && myId != null && last.userId === myId);
  const name = other?.name ?? "알 수 없음";
  const preview = chatPreview(last);
  const time = formatChatListTime(last?.createdAt);

  return (
    <Link
      href={`/chat/${room.id}`}
      className="flex items-center gap-3 border-b border-app-line bg-app-bg px-4 py-[14px] transition-colors hover:bg-app-surface"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-app-placeholder">
        {other?.avatar ? (
          <Image
            src={makeImageUrl(other.avatar, "avatar")}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-cover"
          />
        ) : (
          <PersonIcon />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[16px] font-semibold tracking-[-0.3px] text-app-text">{name}</span>
          <span className="shrink-0 text-[13px] text-app-muted">{time}</span>
        </div>
        <p className="mt-[3px] truncate text-[14px] tracking-[-0.2px] text-app-muted">
          {mine ? "나: " : ""}
          {preview}
        </p>
      </div>

      {room.unreadCount > 0 ? (
        <span
          className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-[10px] bg-app-brand px-1.5 text-[12px] font-bold text-white"
          aria-label={`안 읽은 메시지 ${room.unreadCount}개`}
        >
          {room.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

const ChatClient = () => {
  const { user } = useUser();
  const [keyword, setKeyword] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>("all");

  const { data, error, isLoading, mutate } = useSWR<ChatListResponse>("/api/chat/chatList", {
    refreshInterval: CHAT_LIST_POLL_MS,
  });

  const rooms = useMemo(
    () => filterChatRooms(data?.chatRooms ?? [], { myId: user?.id, keyword, filter }),
    [data?.chatRooms, keyword, filter, user?.id]
  );

  const toggleSearch = () => {
    setSearchOpen((prev) => {
      if (prev) setKeyword("");
      return !prev;
    });
  };

  const isError = (Boolean(error) && !data) || (data ? !data.success : false);
  const isFirstLoading = isLoading && !data;

  return (
    <Layout
      hasTabBar
      title="채팅"
      seoTitle="채팅"
      headerVariant="chat-list"
      headerRight={
        <HeaderIconButton label={searchOpen ? "검색 닫기" : "대화 상대 검색"} onClick={toggleSearch}>
          <SearchIcon />
        </HeaderIconButton>
      }
    >
      <div className="sticky top-14 z-20 bg-app-bg">
        {searchOpen ? (
          <div className="px-4 pb-2 pt-2">
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              autoFocus
              placeholder="대화 상대 검색"
              aria-label="대화 상대 검색"
              className="h-10 w-full rounded-[20px] border-0 bg-app-surface px-4 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:ring-0"
            />
          </div>
        ) : null}
        <div className="flex gap-2 px-4 pb-3 pt-1.5">
          <FilterChip label="전체" selected={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="안 읽음" selected={filter === "unread"} onClick={() => setFilter("unread")} />
        </div>
      </div>

      {isFirstLoading ? (
        <div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonChat key={i} />
          ))}
        </div>
      ) : isError ? (
        <ChatCenterNotice
          title="채팅 목록을 불러오지 못했습니다."
          description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onClick: () => void mutate() }}
        />
      ) : rooms.length > 0 ? (
        <div>
          {rooms.map((room) => (
            <ChatRow key={room.id} room={room} myId={user?.id} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[calc(100dvh-240px)] items-center justify-center px-[21px]">
          <p className="text-center text-[14px] text-app-muted">{chatListEmptyMessage(keyword, filter)}</p>
        </div>
      )}
    </Layout>
  );
};

export default ChatClient;
