import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import { ChatRoom, ChatRoomMember, Message, User } from "@prisma/client";

interface AllChats extends ChatRoom {
  messages: {
    message: Message["message"];
  }[];
  chatRoomMembers: {
    user: {
      avatar: User["avatar"];
      id: User["id"];
      name: User["name"];
    };
  }[];
}

export interface ChatListResponseType {
  success: boolean;
  error?: string;
  AllChats: AllChats[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatListResponseType>
) {
  const {
    session: { user },
  } = req;
  const AllChats = await client.chatRoom.findMany({
    where: {
      chatRoomMembers: {
        some: { userId: user?.id },
      },
    },
    select: {
      id: true,
      updatedAt: true,
      createdAt: true,
      chatRoomMembers: {
        select: {
          user: {
            select: {
              avatar: true,
              id: true,
              name: true,
            },
          },
        },
      },
      messages: {
        select: {
          message: true,
        },
      },
    },
  });

  console.log("AllChats :>> ", AllChats);

  res.json({ success: true, AllChats });
}

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: true })
);
