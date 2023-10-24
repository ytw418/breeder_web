import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import { ChatRoom, ChatRoomMember, Message, User } from "@prisma/client";

interface MessageWithUser extends Message {
  user: {
    name: User["name"];
    avatar: User["avatar"];
  };
}

interface ChatRoomMemberWithUser extends ChatRoomMember {
  user: {
    name: string;
  };
}

interface ChatRoomWithMessage extends ChatRoom {
  chatRoomMembers: ChatRoomMemberWithUser[];
  messages: MessageWithUser[];
}

export interface ChatRoomResponseType {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoomWithMessage;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatRoomResponseType>
) {
  const {
    query: { chatRoomId },
  } = req;

  if (!chatRoomId) {
    return res.json({ success: false, error: "chatRoomId를 확인해주세요" });
  }

  const chatRoom = await client.chatRoom.findUnique({
    where: {
      id: +chatRoomId,
    },
    include: {
      chatRoomMembers: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      messages: {
        include: {
          user: {
            select: {
              name: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (chatRoom) {
    return res.json({ success: true, chatRoom });
  } else {
    return res.json({ success: false, error: "chatRoom을 찾을 수 없습니다." });
  }
}

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: true })
);
