import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    body: { buyorsold, ttsId, isBuyer },
  } = req;

  if (isBuyer) {
    await client.talkToSeller.update({
      where: { id: Number(ttsId) },
      data: { isbuy: buyorsold, isSell: buyorsold },
    });
    res.json({ success: true });
  } else {
    await client.talkToSeller.update({
      where: { id: Number(ttsId) },
      data: { issold: buyorsold, isSell: buyorsold },
    });
    res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
