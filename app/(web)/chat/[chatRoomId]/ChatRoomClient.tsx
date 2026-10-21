"use client";

/**
 * 채팅방 — 앱 bredy_app src/app/chat/[chatRoomId].tsx (시안 A-karrot.html 우측 화면) 1:1.
 * 헤더 64(뒤로 + 상대 이름 16/700·신뢰 줄 12 muted, 누르면 프로필 + 알림 꺼짐 종 + ⋮ 알림·신고·차단·나가기)
 * / 사기 주의 카드(방별로 닫힘) / 날짜 구분 / 말풍선 묶음 / "읽음" / 입력바(+ · pill · 전송).
 * 최신 메시지가 아래, 이전 대화는 맨 위 "이전 대화 보기".
 * 분양글 맥락(앱 docs/prd/trade-review.md S-1, 시안 trade-review #chat-*): URL ?productId 로 열면 card=1&productId 로 방을 받아
 * 문맥 바(viewerAction 버튼: 분양완료·입양 확정·거래 후기 쓰기)·추천 칩을 그리고, 첫 전송에 productId 를 실어 서버가 카드 행을 넣게 한다.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import SkeletonChatRoom from "@components/atoms/SkeletonChatRoom";
import ChatMessageGroup from "@components/features/message";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import { BreederProgramBadge } from "@components/features/breeder/BreederProgramDecorators";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useBlocks } from "hooks/useBlocks";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import { dismissChatScamNotice, isChatScamNoticeDismissed } from "@libs/client/chatScamNotice";
import { profileTrustLine } from "@libs/shared/profileTrust";
import {
  CHAT_SCAM_NOTICE_SUB,
  CHAT_SCAM_NOTICE_TITLE,
  hasRiskyContact,
} from "@libs/shared/contactInText";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

import type { ChatRoomResponse } from "pages/api/chat/[chatRoomId]";
import type { MessageResponse } from "pages/api/chat/[chatRoomId]/message";
import type { ReadResponse } from "pages/api/chat/[chatRoomId]/read";
import {
  CHAT_PAGE_SIZE,
  CHAT_ROOM_POLL_MS,
  buildChatItems,
  composerPlaceholder,
  findPartner,
  findUnreadByPartnerIds,
  formatChatTime,
  imageUploadNotices,
  isDeletedPartnerName,
  mergeMessages,
  olderMessagesCursor,
  planImageUploads,
} from "../chatFormat";
import { BackIcon, BellOffIcon, ChatCenterNotice, MoreIcon, PlusIcon, SendIcon } from "../chatUi";
import { LeaveChatDialog } from "../LeaveChatDialog";
import { ChatStarterChips } from "./ChatStarterChips";
import { ProductContextBar, type ChatTradeAction } from "./ProductContextBar";
import { AdopterPickerSheet } from "@components/features/trade/AdopterPickerSheet";
import { AdoptionConfirmSheet, type AdoptionConfirmProduct } from "@components/features/trade/AdoptionConfirmSheet";
import { TradeReviewSheet, postProductReview } from "@components/features/trade/TradeReviewSheet";
import { isProductCard, productStarterChips } from "@libs/shared/tradeChat";
import { useChatRoomSettings } from "../useChatRoomSettings";
import { chatRoomActions } from "@libs/shared/chatRoomSettings";

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

/** 라우트 ?productId → 양의 정수 id, 아니면 null. */
function parseRouteProductId(value: string | null): number | null {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : null;
}

type MessageBody = { type: "TEXT"; message: string } | { type: "IMAGE"; image: string };

/** 헤더 이름 아래 한 줄: 브리더 프로그램 회색 pill + "거래 완료 3 · 브리디 2개월차"(프로필 신뢰 줄과 같은 글자). */
function RoomHeaderSubtitle({
  programs,
  trustLine,
}: {
  programs?: BreederProgramSummary[] | null;
  trustLine: string | null;
}) {
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
      <BreederProgramBadge programs={programs} className="shrink-0 flex-nowrap" />
      {trustLine ? <span className="min-w-0 truncate text-[12px] leading-4 text-app-muted">{trustLine}</span> : null}
    </div>
  );
}

function RoomHeader({
  title,
  muted = false,
  profileHref,
  programs,
  trustLine = null,
  onBack,
  onMore,
}: {
  title: string;
  muted?: boolean;
  /** 상대 프로필 주소. 탈퇴·차단 상대는 넘기지 않는다(이름을 눌러도 이동하지 않는다). */
  profileHref?: string;
  programs?: BreederProgramSummary[] | null;
  trustLine?: string | null;
  onBack: () => void;
  onMore?: () => void;
}) {
  const hasSubtitle = Boolean(trustLine) || Boolean(programs?.length);
  const nameBlock = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate text-[16px] font-bold tracking-[-0.3px] text-app-text">{title}</h1>
        {muted ? (
          <span className="shrink-0 text-app-muted" aria-label="알림 꺼짐" role="img">
            <BellOffIcon size={16} />
          </span>
        ) : null}
      </span>
      {hasSubtitle ? <RoomHeaderSubtitle programs={programs} trustLine={trustLine} /> : null}
    </>
  );
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-app-line bg-app-bg px-4 text-app-text">
      <button type="button" onClick={onBack} aria-label="뒤로 가기" className="-m-2.5 grid shrink-0 place-items-center p-2.5">
        <BackIcon />
      </button>
      {profileHref ? (
        <Link href={profileHref} className="flex min-w-0 flex-1 flex-col justify-center">
          {nameBlock}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col justify-center">{nameBlock}</div>
      )}
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

/**
 * 사기 주의 카드(시안 A-karrot.html 채팅방 ②): gap 배경 r12 패딩 14, 13 text + 12 muted,
 * 오른쪽 위 X 16 muted(이 방에서만 닫힘), 오른쪽 아래 '신고하기' 13/600 brand-text(채팅방 신고).
 */
function ScamNoticeCard({ onClose, onReport }: { onClose: () => void; onReport: () => void }) {
  return (
    <section aria-label="사기 주의 안내" className="relative rounded-xl bg-app-gap p-3.5">
      <button
        type="button"
        onClick={onClose}
        aria-label="사기 주의 안내 닫기"
        className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center text-app-muted"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <p className="pr-6 text-[13px] leading-[19px] text-app-text">{CHAT_SCAM_NOTICE_TITLE}</p>
      <p className="mt-1 text-[12px] leading-4 text-app-muted">{CHAT_SCAM_NOTICE_SUB}</p>
      <div className="mt-1.5 flex justify-end">
        <button type="button" onClick={onReport} className="-m-1 p-1 text-[13px] font-semibold text-app-brand-text">
          신고하기
        </button>
      </div>
    </section>
  );
}

const ChatRoomClient = () => {
  const { user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();
  const params = useParams();
  const roomId = params?.chatRoomId as string | undefined;
  const searchParams = useSearchParams();
  // 분양글 '채팅하기'로 연 방이면 그 글 id(문맥 바·첫 메시지 카드). 숫자가 아니면 없는 것으로 본다.
  const routeProductId = parseRouteProductId(searchParams?.get("productId") ?? null);

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
  const [leaveOpen, setLeaveOpen] = useState(false);
  // 문맥 바 버튼으로 연 거래 시트(분양완료 → 입양자 지정 / 입양 확정 / 거래 후기)
  const [tradeSheet, setTradeSheet] = useState<ChatTradeAction | null>(null);
  const [sellerReportOpen, setSellerReportOpen] = useState(false);
  // 이 화면에서 productId 를 실어 보내 카드가 들어간(또는 이미 있던) 분양글 id. 그 뒤로는 productId 를 싣지 않는다.
  const [cardSentFor, setCardSentFor] = useState<number | null>(null);

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
  const roomSettings = useChatRoomSettings();

  const { data, error, isLoading, mutate } = useSWR<ChatRoomResponse>(
    // card=1: 문맥 분양글(chatRoom.product)을 같이 받는다(첫 페이지만).
    roomId ? `/api/chat/${roomId}?limit=${CHAT_PAGE_SIZE}&card=1${routeProductId ? `&productId=${routeProductId}` : ""}` : null,
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
  const muted = Boolean(data?.me?.muted);
  // 문맥 분양글(card=1 첫 페이지). 없거나 null(지웠거나 숨긴 글)이면 문맥 바·칩·거래 시트를 그리지 않는다.
  const roomProduct = room?.product ?? null;
  // 헤더 신뢰 줄은 프로필 신뢰 줄과 같은 글자(동네는 넣지 않는다). 탈퇴 상대는 줄도 링크도 없다.
  const trustLine = partner && !partnerDeleted ? profileTrustLine(partner) : null;
  const profileHref = partner && !partnerDeleted && !partnerBlocked ? `/profiles/${partner.id}` : undefined;

  // 사기 주의 카드: 방마다 닫기 전까지 맨 위에. 방 데이터는 브라우저에서만 받으니(서버 렌더엔 없음) 기록을 렌더 중에 읽는다.
  // 메시지와 같은 커밋에 그려야 처음 맨 아래로 내린 스크롤이 카드 높이만큼 밀리지 않는다.
  const [closedScamRoomIds, setClosedScamRoomIds] = useState<number[]>([]);
  const showScamNotice =
    Boolean(room) && !closedScamRoomIds.includes(room!.id) && !isChatScamNoticeDismissed(room!.id);
  const closeScamNotice = () => {
    if (!room) return;
    dismissChatScamNotice(room.id);
    setClosedScamRoomIds((prev) => [...prev, room.id]);
  };

  // 받은 메시지에 계좌·오픈채팅·카톡 아이디가 있으면 받는 쪽에만 주의 줄(보낸 쪽엔 없다).
  const cautionIds = useMemo(() => {
    const ids = new Set<number>();
    for (const message of messages) {
      if (message.user.id !== user?.id && message.type === "TEXT" && !isProductCard(message) && hasRiskyContact(message.message)) ids.add(message.id);
    }
    return ids;
  }, [messages, user?.id]);

  // 카톡 '1': 상대가 안 읽은 내 메시지. 탈퇴한 상대는 읽을 수 없으니 표시하지 않는다.
  const unreadIds = useMemo(
    () => findUnreadByPartnerIds(messages, partnerDeleted ? null : otherMember, user?.id),
    [messages, partnerDeleted, otherMember, user?.id]
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

  // 이 방에 문맥 분양글 카드가 이미 있는지(받은 메시지 안 + 이 화면에서 실어 보낸 것). 더 옛 페이지의 카드는 서버가 중복을 막는다.
  const roomProductHasCard = Boolean(
    roomProduct && (cardSentFor === roomProduct.id || messages.some((message) => message.productId === roomProduct.id))
  );
  // 분양글 '채팅하기'로 연 그 글이고 카드가 아직 없으면 다음 전송에 productId 를 싣는다(서버가 카드 → 본문).
  const cardProductId =
    roomProduct && roomProduct.id === routeProductId && !roomProductHasCard ? roomProduct.id : undefined;
  // 추천 칩: 서버 조건(분양자 아님 · 분양중·예약중 · 카드 없음) + 화면에서 막 보낸 카드·입력 잠금·전송 중이면 숨긴다.
  const starterChips =
    roomProduct?.showStarterChips && !roomProductHasCard && !composerLocked && !sending
      ? productStarterChips(roomProduct)
      : [];

  /**
   * 메시지 전송. productId 를 실으면 이 방에 그 글 카드가 없을 때 서버가 카드 행을 먼저 넣는다(응답 cardMessage).
   * 그사이 글이 지워지거나 숨겨져 400 INVALID_PRODUCT 면 카드 없이 한 번 더 보내 대화가 막히지 않게 한다.
   */
  const sendWithProductCard = async (body: MessageBody, productId?: number): Promise<MessageResult> => {
    if (!productId) return sendMessage({ data: body });
    const result = await sendMessage({ data: { ...body, productId } });
    if (!result?.success && result?.errorCode === "INVALID_PRODUCT") return sendMessage({ data: body });
    return result;
  };

  const canSend = Boolean(text.trim()) && !composerLocked && !sending && !imageUploading;

  const sendText = async (value: string, productId?: number) => {
    // 누르는 즉시 입력창을 비운다. 실패하면 되돌린다(그사이 새로 입력했으면 유지).
    setText("");
    try {
      const result = await sendWithProductCard({ type: "TEXT", message: value }, productId);
      if (!result?.success || !result.message) {
        setText((prev) => prev || value);
        // 차단·탈퇴 상대(403)는 서버 문구를 그대로 보여준다.
        toast.error(result?.error || "메시지 전송에 실패했습니다.");
        return;
      }
      if (productId) setCardSentFor(productId);
      forceBottomRef.current = true;
      const sent = result.message;
      setLocalMessages((prev) => mergeMessages(prev, result.cardMessage ? [result.cardMessage, sent] : [sent]));
      void mutate();
      void globalMutate("/api/chat/chatList");
    } catch {
      setText((prev) => prev || value);
      toast.error("메시지 전송에 실패했습니다.");
    }
  };

  const submitText = async () => {
    const value = text.trim();
    if (!value || composerLocked || sending || imageUploading) return;
    await sendText(value, cardProductId);
  };

  // 추천 칩은 입력창을 거치지 않고 그 문구를 분양글과 함께 바로 보낸다(PRD S-1.빈).
  const sendStarterChip = (chip: string) => {
    if (!roomProduct || composerLocked || sending || imageUploading) return;
    void sendText(chip, roomProduct.id);
  };

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!roomId || files.length === 0 || imageUploading || composerLocked) return;

    const { toSend, summary } = planImageUploads(files);
    setImageUploading(true);
    // 분양글에서 연 방의 첫 메시지가 사진이어도 카드를 넣는다(카드 → 사진). 첫 성공 뒤로는 싣지 않는다.
    let productId = cardProductId;
    try {
      // 장마다 IMAGE 메시지 1개씩 순차 전송. 한 장이 실패해도 나머지는 계속 보낸다.
      for (let index = 0; index < toSend.length; index += 1) {
        const file = toSend[index];
        try {
          const imageId = await uploadChatImage(file);
          const sent = await sendWithProductCard({ type: "IMAGE", image: imageId }, productId);
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
          if (productId) {
            setCardSentFor(productId);
            productId = undefined;
          }
          forceBottomRef.current = true;
          const message = sent.message;
          setLocalMessages((prev) => mergeMessages(prev, sent.cardMessage ? [sent.cardMessage, message] : [message]));
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

  // 문맥 바 버튼 → 거래 시트. 시트가 끝나면 방(viewerAction)·분양 상세·목록·내역을 다시 받는다.
  const refreshTrade = () => {
    void mutate();
    void globalMutate((key) => typeof key === "string" && /^(\$inf\$)?\/api\/(products|users)\//.test(key));
  };
  // 입양 확정·거래 후기 시트의 분양글 요약. 분양자 이름은 이 방 상대가 분양자일 때만 안다.
  const tradeSheetProduct: AdoptionConfirmProduct | null = roomProduct
    ? {
        id: roomProduct.id,
        name: roomProduct.name,
        price: roomProduct.price,
        photo: roomProduct.image,
        sellerName: partner && !partnerDeleted && partner.id === roomProduct.sellerId ? partner.name : "분양자",
        productType: roomProduct.productType,
      }
    : null;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/chat");
  };

  const runAction: Record<string, () => void> = {
    mute: () => room && void roomSettings.setMuted(room.id, true),
    unmute: () => room && void roomSettings.setMuted(room.id, false),
    report: () => setReportOpen(true),
    block: () => partner && setBlockTarget({ id: partner.id, name: partner.name }),
    unblock: () => partner && void unblock(partner.id),
    leave: () => setLeaveOpen(true),
  };
  const sheetActions: ActionSheetAction[] = room
    ? chatRoomActions({ muted, partnerBlocked, canModerate }).map((action) => ({
        key: action.id,
        label: action.label,
        destructive: action.destructive,
        onSelect: runAction[action.id],
      }))
    : [];

  const confirmLeave = async (withBlock: boolean) => {
    if (!room) return;
    const ok = await roomSettings.leave(room.id, withBlock && partner ? partner.id : null);
    if (!ok) return;
    setLeaveOpen(false);
    router.replace("/chat");
  };

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
            <RoomHeader
              title={title}
              muted={muted}
              profileHref={profileHref}
              programs={partnerDeleted ? null : partner?.breederPrograms}
              trustLine={trustLine}
              onBack={goBack}
              onMore={room ? () => setSheetOpen(true) : undefined}
            />

            {roomProduct ? <ProductContextBar product={roomProduct} onAction={setTradeSheet} /> : null}

            <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {isRoomLoading ? (
                <SkeletonChatRoom />
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col">
                  {showScamNotice ? (
                    <div className="px-4 pt-4">
                      <ScamNoticeCard onClose={closeScamNotice} onReport={() => setReportOpen(true)} />
                    </div>
                  ) : null}
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-[14px] text-app-muted">아직 대화가 없습니다.</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 pb-2 pt-4">
                  {showScamNotice ? (
                    <div className="mb-4">
                      <ScamNoticeCard onClose={closeScamNotice} onReport={() => setReportOpen(true)} />
                    </div>
                  ) : null}
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
                        userId={item.userId}
                        timeLabel={formatChatTime(last?.createdAt)}
                        unreadIds={item.mine ? unreadIds : undefined}
                        cautionIds={item.mine ? undefined : cautionIds}
                        onOpenImage={setViewerImageId}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 추천 칩: 입력바 바로 위(시안 #chat-buyer-empty .starter) */}
            <ChatStarterChips chips={starterChips} disabled={imageUploading} onSend={sendStarterChip} />

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
      {/* 문맥 바 버튼의 거래 시트: 분양완료(입양자 지정, 이 방 상대 미리 선택) · 입양 확정(+키워드 후기) · 거래 후기 */}
      {roomProduct && tradeSheetProduct ? (
        <>
          <AdopterPickerSheet
            open={tradeSheet === "sold"}
            productId={roomProduct.id}
            mode="sold"
            preselectUserId={partner && !partnerDeleted ? partner.id : null}
            onClose={() => setTradeSheet(null)}
            onChanged={refreshTrade}
          />
          <AdoptionConfirmSheet
            open={tradeSheet === "confirm"}
            product={tradeSheetProduct}
            onClose={() => setTradeSheet(null)}
            onChanged={refreshTrade}
            onSubmitReview={async (keywords) => {
              await postProductReview(roomProduct.id, keywords);
            }}
          />
          <TradeReviewSheet
            open={tradeSheet === "review"}
            product={tradeSheetProduct}
            onClose={() => setTradeSheet(null)}
            onChanged={refreshTrade}
            onReportSeller={() => setSellerReportOpen(true)}
          />
          <ReportSheet
            open={sellerReportOpen}
            targetType="USER"
            targetId={roomProduct.sellerId}
            onClose={() => setSellerReportOpen(false)}
          />
        </>
      ) : null}
      <LeaveChatDialog
        open={leaveOpen}
        partnerName={canModerate && partner ? partner.name : null}
        canBlock={canModerate && !partnerBlocked}
        loading={roomSettings.pending}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={(withBlock) => void confirmLeave(withBlock)}
        onReport={() => {
          setLeaveOpen(false);
          setReportOpen(true);
        }}
      />
    </div>
  );
};

export default ChatRoomClient;
