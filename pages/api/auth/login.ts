import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const { token, user } = req.body;
  if (!token) {
    return res.status(401).end();
  }

  console.log("로그인 API =>", token, user);
  req.session.token = token;
  req.session.user = user;

  await req.session.save();
  res.json({ success: true });
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: false })
);
