import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  try {
    if (req.method === "GET") {
      const profile = await client.user.findUnique({
        where: { id: req.session.user?.id },
      });
      console.log("profile :>> ", profile);
      res.json({
        success: true,
        profile,
      });
    }
    if (req.method === "POST") {
      const {
        session: { user },
        body: { name, avatarId },
      } = req;

      if (name) {
        await client.user.update({
          where: {
            id: user?.id,
          },
          data: {
            name,
          },
        });
      }
      if (avatarId) {
        await client.user.update({
          where: {
            id: user?.id,
          },
          data: {
            avatar: avatarId,
          },
        });
      }
      res.json({ success: true });
    }
  } catch (error) {
    res.json({ success: false, error: JSON.stringify(error) });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
  })
);
