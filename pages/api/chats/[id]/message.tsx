import client from "@libs/server/client";
import withHandler, { IResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IResponseType>
) {
  const {
    session: { user },
    query: { talktosellerid },
    body: { message },
  } = req;

  await client.message.create({
    data: {
      message,
      user: {
        connect: {
          id: user?.id,
        },
      },
      talktoseller: {
        connect: {
          id: Number(talktosellerid),
        },
      },
    },
  });

  res.json({ success: true });
}

export default withApiSession(withHandler({ methods: ["POST"], handler }));
