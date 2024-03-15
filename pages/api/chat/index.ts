import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

export interface ChatRequestType {
  otherId: number;
}

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
    if (typeof otherId !== "number") {
      return res.json({
        success: false,
        error: "otherId가 number가 아닙니다.",
      });
    }

    const userIds = [user?.id!, otherId];

    console.log("userIds :>> ", userIds);

    const findChatRoom = await findChatRoomByUserIds(userIds);

    console.log("findChatRoom :>> ", findChatRoom);

    if (findChatRoom) {
      // 채팅룸이 이미 있을 때
      return res.json({ success: true, ChatRoomId: findChatRoom.id });
    } else {
      // 채팅룸이 없을 떄
      // 채팅룸 생성 > 채팅 맴버 추가
      const createdChatRoom = await createChatRoomWithMembers(userIds);

      if (createdChatRoom) {
        return res.json({ success: true, ChatRoomId: createdChatRoom });
      } else {
        return res.json({ success: false, error: "채팅방 생성 실패" });
      }
    }
  } catch (error) {
    console.error("Error in chat handler:", error);
    return res.json({
      success: false,
      error: "채팅 처리 중 오류가 발생했습니다. >> :" + JSON.stringify(error),
    });
  }
}

/** 유저가 있는 채팅방 찾기 1:1 */
const findChatRoomByUserIds = async (userIds: number[]) => {
  return await client.chatRoom.findFirst({
    where: {
      chatRoomMembers: {
        some: {
          userId: { in: userIds },
        },
      },
    },
  });
};
/** ChatRoom을 생성합니다 */
const createChatRoomWithMembers = async (userIds: number[]) => {
  const createdChatRoom = await client.chatRoom.create({
    data: {
      // ChatRoomMembers를 생성하면서 chatRoom에 연결됨
      chatRoomMembers: {
        createMany: {
          data: userIds.map((userId) => ({
            userId,
          })),
        },
      },
    },
  });

  return createdChatRoom.id;
};

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
