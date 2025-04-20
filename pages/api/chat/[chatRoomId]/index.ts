import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import {
  ChatRoom as PrismaChatRoom,
  Message as PrismaMessage,
  User,
} from "@prisma/client";

// 채팅방 멤버 인터페이스 정의
export interface ChatRoomMember {
  id: number;
  userId: number;
  chatRoomId: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  isBuyer: boolean; // 구매자 여부
  lastReadAt: string | null; // 마지막으로 메시지를 읽은 시간
}

// 메시지 인터페이스 정의
export interface Message {
  id: number;
  message: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

// 상품 정보 인터페이스 정의
interface Product {
  id: number;
  name: string;
  price: number;
  photos: string[];
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

// 채팅방 인터페이스 정의
export interface ChatRoom {
  id: number;
  type: "profile" | "product"; // 채팅방 타입 (프로필/상품)
  productId: number | null;
  chatRoomMembers: ChatRoomMember[]; // 채팅방 멤버 목록
  messages: Message[]; // 메시지 목록
  product?: Product; // 상품 정보 (상품 채팅방인 경우)
  buyerConfirmed: boolean; // 구매자 확인 여부
  sellerConfirmed: boolean; // 판매자 확인 여부
  isCompleted: boolean; // 거래 완료 여부
}

// API 응답 인터페이스 정의
export interface ChatRoomResponse {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoom;
}

// 채팅방 정보 조회 핸들러
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatRoomResponse>
) {
  // GET 메서드만 허용
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      query: { chatRoomId },
      session: { user },
    } = req;

    // 로그인 체크
    if (!user?.id) {
      return res.json({ success: false, error: "로그인이 필요합니다." });
    }

    // 채팅방 정보 조회
    const chatRoom = await client.chatRoom.findUnique({
      where: {
        id: +chatRoomId!,
      },
      include: {
        // 상품 정보 포함
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            photos: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        // 메시지 목록 포함 (생성일 기준 오름차순 정렬)
        messages: {
          select: {
            id: true,
            message: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        // 채팅방 멤버 정보 포함
        chatRoomMembers: {
          select: {
            id: true,
            userId: true,
            chatRoomId: true,
            isBuyer: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // 채팅방이 존재하지 않는 경우
    if (!chatRoom) {
      return res.json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // 성공 응답 반환
    return res.json({
      success: true,
      chatRoom: {
        id: chatRoom.id,
        type: chatRoom.type as "profile" | "product",
        productId: chatRoom.productId,
        product: chatRoom.product || undefined,
        messages: chatRoom.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(), // 날짜를 ISO 문자열로 변환
        })),
        chatRoomMembers: chatRoom.chatRoomMembers.map((member) => ({
          ...member,
          lastReadAt: member.lastReadAt?.toISOString() || null, // 날짜를 ISO 문자열로 변환
        })),
        buyerConfirmed: chatRoom.buyerConfirmed,
        sellerConfirmed: chatRoom.sellerConfirmed,
        isCompleted: chatRoom.isCompleted,
      },
    });
  } catch (error) {
    // 에러 처리
    console.error("Error in chat room handler:", error);
    return res.json({
      success: false,
      error: "채팅방 정보를 불러오는데 실패했습니다.",
    });
  }
}

// 세션 및 핸들러 미들웨어 적용
export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true, // 인증된 사용자만 접근 가능
  })
);
