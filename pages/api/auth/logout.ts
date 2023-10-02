import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  req.session.destroy();
  res.status(200).end("logout");
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
