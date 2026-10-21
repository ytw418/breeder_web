import client from "@libs/server/client";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { NextApiRequest, NextApiResponse } from "next";
import { MessageType } from "@prisma/client";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import { countCompletedSales, countTradeReviews } from "@libs/server/profileTrust";
import {
  loadChatMessageProducts,
  parseChatProductId,
  resolveChatRoomProduct,
} from "@libs/server/chatProduct";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import type { ChatMessageProduct, ChatRoomProduct } from "@libs/shared/tradeChat";

// 채팅방 멤버 인터페이스
export interface ChatRoomMember {
  id: number;
  userId: number;
  chatRoomId: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
    /** 헤더 신뢰 줄 "브리디 N개월차"(2026-10-21~, 옛 서버는 없음). */
    createdAt?: string;
    /** 헤더 뱃지(활성 프로그램만, 우선순위 순). */
    breederPrograms?: BreederProgramSummary[];
    /** 헤더 신뢰 줄 "거래 완료 N". 상대 멤버에만 넣는다(이전 대화 페이지에서는 빠진다). */
    completedSales?: number;
    /** 헤더 신뢰 줄 "후기 N"(받은 거래 후기, 2026-10-21~). completedSales 와 같은 조건으로 넣는다. */
    tradeReviews?: number;
  };
  lastReadAt: string | null;
}

// 메시지 인터페이스
export interface Message {
  id: number;
  type: MessageType;
  message: string;
  image: string | null;
  createdAt: string;
  /** 분양글 카드 행이면 분양글 id(2026-10-21~). 새 앱·웹은 카드 말풍선으로 그린다. */
  productId: number | null;
  /** 카드 분양글 요약. 지웠거나 숨긴 글·본문 행은 null */
  product: ChatMessageProduct | null;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

// 채팅방 인터페이스
export interface ChatRoom {
  id: number;
  chatRoomMembers: ChatRoomMember[];
  messages: Message[];
  /**
   * 문맥 바·추천 칩의 분양글. `?card=1` 로 요청한 첫 페이지에만 넣는다(옛 앱은 card 를 보내지 않아 필드가 없다).
   * ?productId 글(방 멤버의 보이는 글) → 없으면 방의 최근 카드 글, 둘 다 없으면 null.
   */
  product?: ChatRoomProduct | null;
}

export interface ChatPagination {
  limit: number;
  hasMore: boolean;
  nextCursor: number | null;
}

// API 응답 인터페이스
export interface ChatRoomResponse {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoom;
  /** 내 방 설정. 상대의 알림·나가기 상태는 내려주지 않는다. */
  me?: { muted: boolean };
  pagination?: ChatPagination;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatRoomResponse>
) {
  try {
    const {
      query: { chatRoomId, limit = "20", beforeId, card, productId: productIdParam },
      user,
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    const roomId = Number(chatRoomId);
    if (Number.isNaN(roomId)) {
      return res
        .status(400)
        .json({ success: false, error: "유효하지 않은 채팅방 ID입니다." });
    }

    const parsedLimit = Number(limit);
    const pageSize = Number.isNaN(parsedLimit)
      ? 20
      : Math.min(Math.max(parsedLimit, 1), 50);
    const parsedBeforeId =
      beforeId === undefined ? null : Number(beforeId);
    const hasBeforeCursor =
      parsedBeforeId !== null && !Number.isNaN(parsedBeforeId);

    // 채팅방 조회 + 멤버 권한 체크
    const chatRoom = await client.chatRoom.findFirst({
      where: {
        id: roomId,
        chatRoomMembers: {
          some: { userId: user.id },
        },
      },
      include: {
        chatRoomMembers: {
          select: {
            id: true,
            userId: true,
            chatRoomId: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                createdAt: true,
                breederPrograms: {
                  where: { status: "ACTIVE" },
                  select: breederProgramSummarySelect,
                },
              },
            },
          },
        },
      },
    });

    if (!chatRoom) {
      return res
        .status(404)
        .json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // 내가 나간 방이면 나간 뒤 메시지만 보여 준다(상대 화면은 그대로다).
    const myMembership = await client.chatRoomMember.findUnique({
      where: { userId_chatRoomId: { userId: user.id, chatRoomId: roomId } },
      select: { leftAt: true, mutedAt: true },
    });
    const leftAt = myMembership?.leftAt ?? null;

    const messageWhere: {
      chatRoomId: number;
      id?: { lt: number };
      createdAt?: { gt: Date };
    } = { chatRoomId: roomId };
    if (leftAt) messageWhere.createdAt = { gt: leftAt };
    if (hasBeforeCursor && parsedBeforeId !== null) {
      messageWhere.id = { lt: parsedBeforeId };
    }

    // 최신순으로 pageSize만 가져온 뒤, UI 표시용으로 다시 오름차순 정렬
    const latestChunk = await client.message.findMany({
      where: messageWhere,
      select: {
        id: true,
        type: true,
        message: true,
        image: true,
        createdAt: true,
        productId: true,
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { id: "desc" },
      take: pageSize,
    });

    const orderedMessages = [...latestChunk].reverse();
    const oldestMessageId = orderedMessages[0]?.id;

    const olderMessage = oldestMessageId
      ? await client.message.findFirst({
          where: {
            chatRoomId: roomId,
            id: { lt: oldestMessageId },
            ...(leftAt ? { createdAt: { gt: leftAt } } : {}),
          },
          select: { id: true },
          orderBy: { id: "desc" },
        })
      : null;

    const hasMore = Boolean(olderMessage);
    const nextCursor = hasMore ? oldestMessageId ?? null : null;

    // 헤더 신뢰 줄 "거래 완료 N · 후기 N"은 상대만 센다. 이전 대화 페이지는 헤더를 다시 그리지 않으니 세지 않는다.
    const partnerIds = chatRoom.chatRoomMembers
      .map((member) => member.userId)
      .filter((memberId) => memberId !== user.id);
    const requestedProductId = parseChatProductId(
      Array.isArray(productIdParam) ? productIdParam[0] : productIdParam
    );
    const [trustCounts, messageProducts, roomProduct] = await Promise.all([
      hasBeforeCursor
        ? []
        : Promise.all(
            partnerIds.map(async (partnerId) => {
              const [completedSales, tradeReviews] = await Promise.all([
                countCompletedSales(partnerId),
                countTradeReviews(partnerId),
              ]);
              return [partnerId, { completedSales, tradeReviews }] as const;
            })
          ),
      loadChatMessageProducts(orderedMessages.map((message) => message.productId)),
      // 문맥 바는 card=1 로 요청한 첫 페이지에만(옛 앱 화면에 '예약하기' 바가 새로 생기지 않게).
      card === "1" && !hasBeforeCursor
        ? resolveChatRoomProduct({
            chatRoomId: roomId,
            viewerId: user.id,
            memberIds: chatRoom.chatRoomMembers.map((member) => member.userId),
            requestedProductId: requestedProductId === "invalid" ? null : requestedProductId,
          }).catch((error) => {
            // 문맥 바는 부가 정보다. 읽지 못하면 필드만 빼고 대화는 그대로 보여 준다.
            console.error("Failed to resolve chat room product:", error);
            return undefined;
          })
        : undefined,
    ]);
    const trustByUser = new Map(trustCounts);

    return res.json({
      success: true,
      chatRoom: {
        id: chatRoom.id,
        messages: orderedMessages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
          productId: message.productId ?? null,
          product: message.productId != null ? messageProducts.get(message.productId) ?? null : null,
        })),
        chatRoomMembers: chatRoom.chatRoomMembers.map(({ user: memberUser, ...member }) => {
          const trust = trustByUser.get(member.userId);
          return {
            ...member,
            lastReadAt: member.lastReadAt?.toISOString() || null,
            user: {
              id: memberUser.id,
              name: memberUser.name,
              avatar: memberUser.avatar,
              createdAt: memberUser.createdAt.toISOString(),
              breederPrograms: getSortedActiveBreederProgramSummaries(memberUser.breederPrograms),
              ...(trust ?? {}),
            },
          };
        }),
        ...(roomProduct === undefined ? {} : { product: roomProduct }),
      },
      me: { muted: Boolean(myMembership?.mutedAt) },
      pagination: {
        limit: pageSize,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Error in chat room handler:", error);
    return res.status(500).json({
      success: false,
      error: "채팅방 정보를 불러오는데 실패했습니다.",
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
