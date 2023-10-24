import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    session: { user },
    query: { chatRoomId },
    body: { message },
  } = req;

  await client.message.create({
    data: {
      message,
      user: {
        connect: {
          id: Number(user?.id),
        },
      },
      chatRoom: {
        connect: {
          id: Number(chatRoomId),
        },
      },
    },
  });

  res.json({ success: true });
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
