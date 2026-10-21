import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { MessageType } from "@prisma/client";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import { filterPushRecipients } from "@libs/server/notificationGate";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
import { assertCanChat, CHAT_PARTNER_DELETED_MESSAGE } from "@libs/server/blocks";
import { assertWriteAllowed } from "@libs/server/writeLimits";
import {
  findRoomProduct,
  needsProductCard,
  parseChatProductId,
  sendMessageWithProductCard,
  toChatMessageProduct,
  type ChatProductRow,
  type SentMessageRow,
} from "@libs/server/chatProduct";
import type { ChatMessageProduct } from "@libs/shared/tradeChat";

/** 클라이언트가 보낼 수 있는 메시지 종류. 분양글 카드(TEXT + productId)는 서버만 만든다. */
const CLIENT_MESSAGE_TYPES = new Set<string>(["TEXT", "IMAGE"]);

interface SentMessage {
  id: number;
  type: MessageType;
  message: string;
  image: string | null;
  createdAt: string;
  /** 분양글 카드 행이면 분양글 id. 본문 행은 null */
  productId: number | null;
  /** 카드 말풍선용 분양글 요약. 본문 행은 null */
  product: ChatMessageProduct | null;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: SentMessage;
  /** 이 요청에서 분양글 카드가 새로 들어갔으면 그 행(본문 바로 앞). 2026-10-21~ */
  cardMessage?: SentMessage;
}

function toSentMessage(row: SentMessageRow, product: ChatProductRow | null): SentMessage {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
    productId: row.productId ?? null,
    product: row.productId != null && product ? toChatMessageProduct(product) : null,
    user: row.user,
  };
}

const INVALID_PRODUCT_RESPONSE = {
  success: false,
  error: "이 채팅방에서 보낼 수 없는 분양글이에요.",
  errorCode: "INVALID_PRODUCT",
} as const;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MessageResponse>
) {
  try {
    const {
      query: { chatRoomId },
      user,
      body: { type = "TEXT", message, image, productId: rawProductId },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    // 분양글 카드(type TEXT + productId)는 서버만 만든다. 클라이언트는 TEXT·IMAGE 만 보낸다.
    if (typeof type !== "string" || !CLIENT_MESSAGE_TYPES.has(type)) {
      return res
        .status(400)
        .json({ success: false, error: "보낼 수 없는 메시지 형식이에요.", errorCode: "INVALID_TYPE" });
    }
    const productId = parseChatProductId(rawProductId);
    if (productId === "invalid") {
      return res.status(400).json(INVALID_PRODUCT_RESPONSE);
    }

    // 메시지 유효성 검사
    if (type === "TEXT" && (!message || message.trim() === "")) {
      return res
        .status(400)
        .json({ success: false, error: "메시지를 입력해주세요." });
    }

    if (type === "IMAGE" && !image) {
      return res
        .status(400)
        .json({ success: false, error: "이미지가 없습니다." });
    }

    // 채팅방 멤버 확인
    const chatRoom = await client.chatRoom.findFirst({
      where: {
        id: +chatRoomId!,
        chatRoomMembers: {
          some: { userId: user.id },
        },
      },
    });

    if (!chatRoom) {
      return res
        .status(404)
        .json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // 1:1 채팅방의 상대 멤버. 푸시 수신자로도 쓴다.
    const otherMembers = await client.chatRoomMember.findMany({
      where: {
        chatRoomId: +chatRoomId!,
        userId: { not: user.id },
      },
      select: { userId: true, mutedAt: true },
    });

    // 차단(양방향)·탈퇴한 상대에게는 보내지 않는다. 저장·푸시 전에 막는다.
    const partner = otherMembers[0];
    if (!partner) {
      return res.status(403).json({
        success: false,
        error: CHAT_PARTNER_DELETED_MESSAGE,
        errorCode: "CHAT_PARTNER_DELETED",
      });
    }
    const canChat = await assertCanChat(user.id, partner.userId);
    if (!canChat.ok) {
      return res
        .status(canChat.status)
        .json({ success: false, error: canChat.error, errorCode: canChat.errorCode });
    }

    // 분양글에서 연 방(productId): 방 멤버의 보이는 글만 카드로 받는다. 카드가 아직 없으면 lock 안에서 카드 → 본문.
    const memberIds = [user.id, ...otherMembers.map((member) => member.userId)];
    const cardProduct = productId === null ? null : await findRoomProduct(productId, memberIds);
    if (productId !== null && !cardProduct) {
      return res.status(400).json(INVALID_PRODUCT_RESPONSE);
    }
    const withCard = cardProduct ? await needsProductCard(+chatRoomId!, cardProduct.id) : false;

    const data = {
      type: type as MessageType,
      message: type === "IMAGE" ? "사진을 보냈습니다." : message!,
      image: type === "IMAGE" ? image : null,
    };

    let sent: { message: SentMessageRow; card: SentMessageRow | null };
    if (withCard && cardProduct) {
      // 같은 본문 한도는 lock 안에서 센다(카드가 정말 새로 들어갈 때만 본문을 뺀다).
      const result = await sendMessageWithProductCard({
        chatRoomId: +chatRoomId!,
        senderId: user.id,
        product: cardProduct,
        ...data,
      });
      if (result.blocked) {
        return res
          .status(result.blocked.status)
          .json({ success: false, error: result.blocked.error, errorCode: result.blocked.errorCode });
      }
      sent = { message: result.message, card: result.card };
    } else {
      // 같은 글을 10분에 3번 넘게 보내면 막는다(감사 24번, 여러 방에 같은 글 뿌리기). 사진은 세지 않는다.
      if (type === "TEXT") {
        const writeLimit = await assertWriteAllowed({ userId: user.id, kind: "message", text: message });
        if (writeLimit) {
          return res
            .status(writeLimit.status)
            .json({ success: false, error: writeLimit.error, errorCode: writeLimit.errorCode });
        }
      }

      // 메시지 생성 + 채팅방 updatedAt 갱신을 트랜잭션으로 처리
      const [created] = await client.$transaction([
        client.message.create({
          data: {
            ...data,
            user: { connect: { id: user.id } },
            chatRoom: { connect: { id: +chatRoomId! } },
          },
          select: {
            id: true,
            type: true,
            message: true,
            image: true,
            createdAt: true,
            productId: true,
            user: { select: { id: true, name: true, avatar: true } },
          },
        }),
        // 채팅방 updatedAt 갱신 (채팅 목록 정렬에 반영)
        client.chatRoom.update({
          where: { id: +chatRoomId! },
          data: { updatedAt: new Date() },
        }),
      ]);
      sent = { message: created, card: null };
    }
    const newMessage = sent.message;

    // 발신자를 뺀 채팅방 멤버 중 이 방 알림을 끄지 않은 사람만 남기고, 채팅 알림을 껐거나 방해 금지 시간인 사람은 뺀다.
    const pushRecipientIds = await filterPushRecipients(
      otherMembers.filter((member) => !member.mutedAt).map((member) => member.userId),
      "CHAT"
    );
    const pushBody =
      newMessage.type === "IMAGE"
        ? `${newMessage.user.name}님이 사진을 보냈습니다.`
        : `${newMessage.user.name}: ${newMessage.message}`;

    // 푸시 전송은 부가 기능이므로 응답 지연을 막기 위해 비동기로 분리한다.
    if (pushRecipientIds.length > 0) sendAllPushToUsers(pushRecipientIds, {
      title: "새 채팅 메시지",
      body: pushBody,
      url: `/chat/${chatRoomId}`,
      tag: `chat-${chatRoomId}`,
    }).catch((error) => console.error("Failed to send chat push:", error));

    const platform = resolveClientPlatform(req);
    await Promise.all([
      captureServerEvent(user.id, "chat_message_sent", {
        chat_room_id: +chatRoomId!,
        message_type: newMessage.type,
        platform,
      }),
      sent.card && cardProduct
        ? captureServerEvent(user.id, "product_card_sent", {
            product_id: cardProduct.id,
            chat_room_id: +chatRoomId!,
            by_seller: cardProduct.userId === user.id,
            platform,
          })
        : undefined,
    ]);

    return res.json({
      success: true,
      message: toSentMessage(newMessage, null),
      ...(sent.card ? { cardMessage: toSentMessage(sent.card, cardProduct) } : {}),
    });
  } catch (error) {
    console.error("Error in message handler:", error);
    return res.status(500).json({
      success: false,
      error: "메시지 전송에 실패했습니다.",
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
