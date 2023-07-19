import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { User } from "@prisma/client";

export interface UserResponse {
  user?: User;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (!req.query.id) {
    return res.status(400).json({
      message: "query에 id가 없습니다.",
    });
  }
  const user = await client.user.findUnique({
    where: { id: +req.query.id },
  });
  return res.json({ user: user });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
