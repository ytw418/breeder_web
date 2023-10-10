import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import { ChatRoom } from "@prisma/client";

export interface ChatResponseType {
  success: boolean;
  error?: string;
  ChatRoomId?: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponseType>
) {
  try {
    const {
      session: { user },
      body: { otherId },
    } = req;

    if (!otherId) {
      return res.json({ success: false, error: "otherId 가 없습니다." });
    }

    const userIds = [user?.id!, +otherId];

    console.log("userIds :>> ", userIds);

    const findChatRoom = await findChatRoomByUserIds(userIds);

    if (findChatRoom) {
      // 채팅룸이 이미 있을 때
      return res.json({ success: true, ChatRoomId: findChatRoom.id });
    } else {
      // 채팅룸이 없을 떄
      // 채팅룸 생성 > 채팅 맴버 추가
      const createdChatRoom = await createChatRoomWithMembers(userIds);

      if (createdChatRoom) {
        return res.json({ success: true, ChatRoomId: createdChatRoom.id });
      } else {
        return res.json({ success: false, error: "채팅방 생성 실패" });
      }
    }
  } catch (error) {
    console.error("Error in chat handler:", error);
    return res.json({
      success: false,
      error: "채팅 처리 중 오류가 발생했습니다.",
    });
  }
}

const findChatRoomByUserIds = async (userIds: number[]) => {
  return await client.chatRoom.findFirst({
    where: {
      chatRoomMembers: {
        every: {
          userId: { in: userIds },
        },
      },
    },
  });
};

const createChatRoomWithMembers = async (userIds: number[]) => {
  // ChatRoom을 먼저 생성합니다.
  const createdChatRoom = await client.chatRoom.create({
    data: {
      // ChatRoomMembers를 생성하지 않습니다.
    },
  });

  // 생성된 ChatRoom의 ID를 가져옵니다.
  const chatRoomId = createdChatRoom.id;

  // ChatRoomMembers를 생성하고 ChatRoom과 연결합니다.
  const createChatRoomMembers = await client.chatRoomMember.createMany({
    data: userIds.map((userId) => ({
      userId,
      chatRoomId, // ChatRoom과 연결합니다.
    })),
  });
  console.log("createChatRoomMembers :>> ", createChatRoomMembers);

  return createdChatRoom;
};

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
