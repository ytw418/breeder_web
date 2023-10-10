import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
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
      return res.json({ success: true, findChatRoom });
    } else {
      const createdChatRoom = await createChatRoomWithMembers(userIds);

      const check = await findChatRoomByUserIds(userIds);

      console.log("check :>> ", check);

      if (createdChatRoom) {
        return res.json({ success: true, createdChatRoom });
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
        some: {
          userId: { in: [8, 1] },
        },
      },
    },
    include: {
      messages: true,
      chatRoomMembers: true,
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

  (createChatRoomMembers.count === 2){
    return t
  }

  // ChatRoom과 ChatRoomMembers가 생성 및 연결되었습니다.
  return createdChatRoom;
};

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
