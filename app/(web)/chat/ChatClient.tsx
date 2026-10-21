"use client";

/**
 * 채팅 목록 — 앱 bredy_app src/app/(tabs)/chat.tsx (시안 A-karrot.html 좌측 화면) 1:1.
 * 헤더 "채팅" 좌측 + 검색 토글 + 알림 벨 / 전체·안 읽음 칩 / 행(44 아바타·이름·시간·미리보기·주황 unread 뱃지).
 * 알림 끈 방은 이름 옆 종 끔 + 회색 뱃지. 행을 길게 누르거나 우클릭하면 알림·신고·차단·나가기 시트(docs/prd/chat-room-settings.md).
 * 분양글 카드가 있는 방만 오른쪽에 그 글 썸네일 56 r8, 카드가 마지막이면 미리보기 '분양글을 보냈어요'(시안 trade-review #list-row).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import SkeletonChat from "@components/atoms/SkeletonChat";
import { FilterChip } from "@components/app/FilterChip";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import EmptyState from "@components/ui/EmptyState";
import useUser from "hooks/useUser";
import { useBlocks } from "hooks/useBlocks";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import { chatRoomActions, chatRoomSheetTitle } from "@libs/shared/chatRoomSettings";
import { LeaveChatDialog } from "./LeaveChatDialog";
import { useChatRoomSettings } from "./useChatRoomSettings";
import { useLongPress } from "./useLongPress";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { ChatListResponse } from "pages/api/chat/chatList";
import {
  CHAT_LIST_POLL_MS,
  chatListEmptyMessage,
  chatPreview,
  filterChatRooms,
  findPartner,
  formatChatListTime,
  isDeletedPartnerName,
  type ChatFilter,
} from "./chatFormat";
import { BellOffIcon, ChatCenterNotice, PersonIcon, SearchIcon } from "./chatUi";

type ChatRoomItem = ChatListResponse["chatRooms"][number];

function ChatRow({ room, myId, onLongPress }: { room: ChatRoomItem; myId?: number; onLongPress: () => void }) {
  const other = findPartner(room.chatRoomMembers, myId)?.user;
  const last = room.lastMessage;
  const mine = Boolean(last && myId != null && last.userId === myId);
  const name = other?.name ?? "알 수 없음";
  const preview = chatPreview(last);
  const time = formatChatListTime(last?.createdAt);
  const longPress = useLongPress(onLongPress);

  return (
    <Link
      href={`/chat/${room.id}`}
      {...longPress}
      className="flex select-none items-center gap-3 border-b border-app-line bg-app-bg px-4 py-[14px] transition-colors [-webkit-touch-callout:none] hover:bg-app-surface"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-app-placeholder">
        {other?.avatar ? (
          <Image
            src={makeImageUrl(other.avatar, "avatar")}
            alt={`${name} 프로필 사진`}
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
          {room.muted ? (
            <span className="shrink-0 self-center text-app-muted" aria-label="알림 꺼짐" role="img">
              <BellOffIcon />
            </span>
          ) : null}
          <span className="shrink-0 text-[13px] text-app-muted">{time}</span>
        </div>
        <p className="mt-[3px] truncate text-[14px] tracking-[-0.2px] text-app-muted">
          {mine ? "나: " : ""}
          {preview}
        </p>
      </div>

      {room.unreadCount > 0 ? (
        <span
          className={cn(
            "flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-[10px] px-1.5 text-[12px] font-bold text-white",
            room.muted ? "bg-app-caption" : "bg-app-brand"
          )}
          aria-label={`안 읽은 메시지 ${room.unreadCount}개`}
        >
          {room.unreadCount}
        </span>
      ) : null}

      {room.product ? (
        <div
          aria-label={`분양글 ${room.product.name}`}
          role="img"
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-app-placeholder"
        >
          {room.product.image ? (
            <Image
              src={makeImageUrl(room.product.image, "product")}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

const ChatClient = () => {
  const { user } = useUser();
  const [keyword, setKeyword] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>("all");
  // 길게 누른 방(시트) → 신고·차단·나가기 대상
  const [menuRoom, setMenuRoom] = useState<ChatRoomItem | null>(null);
  const [reportRoomId, setReportRoomId] = useState<number | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: number; name: string } | null>(null);
  const [leaveRoom, setLeaveRoom] = useState<ChatRoomItem | null>(null);
  const { isBlocked } = useBlocks();
  const roomSettings = useChatRoomSettings();

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

  const partnerOf = (room: ChatRoomItem | null) => (room ? findPartner(room.chatRoomMembers, user?.id)?.user : undefined);
  const menuPartner = partnerOf(menuRoom);
  const menuCanModerate = Boolean(menuPartner && !isDeletedPartnerName(menuPartner.name));
  const menuActions: ActionSheetAction[] = menuRoom
    ? chatRoomActions({
        muted: menuRoom.muted,
        partnerBlocked: isBlocked(menuPartner?.id),
        canModerate: menuCanModerate,
      })
        // 차단한 상대의 방은 목록에 없으므로 '차단 해제'는 나오지 않는다.
        .filter((action) => action.id !== "unblock")
        .map((action) => {
          const target = menuRoom;
          const run: Record<string, () => void> = {
            mute: () => void roomSettings.setMuted(target.id, true),
            unmute: () => void roomSettings.setMuted(target.id, false),
            report: () => setReportRoomId(target.id),
            block: () => menuPartner && setBlockTarget({ id: menuPartner.id, name: menuPartner.name }),
            leave: () => setLeaveRoom(target),
          };
          return { key: action.id, label: action.label, destructive: action.destructive, onSelect: run[action.id] };
        })
    : [];
  const leavePartner = partnerOf(leaveRoom);
  const leaveCanModerate = Boolean(leavePartner && !isDeletedPartnerName(leavePartner.name));

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
            <ChatRow key={room.id} room={room} myId={user?.id} onLongPress={() => setMenuRoom(room)} />
          ))}
        </div>
      ) : !keyword.trim() && filter === "all" ? (
        // 대화 0개(§3.1): '없습니다' 대신 다음 행동. 근처 같은 종 사용자 수 API 가 아직 없어 둘째 문구를 쓴다.
        <div className="flex min-h-[calc(100dvh-240px)] items-center justify-center">
          <EmptyState
            icon={
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
              </svg>
            }
            title="분양글에서 인사를 보내 보세요"
            description="궁금한 개체에 채팅을 보내면 여기에 모여요"
            action={{ label: "분양글 둘러보기", href: "/products" }}
          />
        </div>
      ) : (
        <div className="flex min-h-[calc(100dvh-240px)] items-center justify-center px-[21px]">
          <p className="text-center text-[14px] text-app-muted">{chatListEmptyMessage(keyword, filter)}</p>
        </div>
      )}

      <ActionSheet
        open={Boolean(menuRoom)}
        onClose={() => setMenuRoom(null)}
        title={chatRoomSheetTitle(menuCanModerate ? menuPartner?.name : null)}
        actions={menuActions}
      />
      <ReportSheet
        open={reportRoomId !== null}
        targetType="CHAT_ROOM"
        targetId={reportRoomId}
        onClose={() => setReportRoomId(null)}
      />
      <BlockConfirmDialog target={blockTarget} onClose={() => setBlockTarget(null)} />
      <LeaveChatDialog
        open={Boolean(leaveRoom)}
        partnerName={leaveCanModerate && leavePartner ? leavePartner.name : null}
        canBlock={leaveCanModerate}
        loading={roomSettings.pending}
        onCancel={() => setLeaveRoom(null)}
        onConfirm={async (withBlock) => {
          if (!leaveRoom) return;
          const ok = await roomSettings.leave(leaveRoom.id, withBlock && leavePartner ? leavePartner.id : null);
          if (ok) setLeaveRoom(null);
        }}
        onReport={() => {
          if (!leaveRoom) return;
          setReportRoomId(leaveRoom.id);
          setLeaveRoom(null);
        }}
      />
    </Layout>
  );
};

export default ChatClient;
