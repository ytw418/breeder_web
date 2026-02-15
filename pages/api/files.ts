import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import { withApiSession } from "@libs/server/withSession";

async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const cloudResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ID}/images/v1/direct_upload`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CF_TOKEN}`,
      },
    }
  );

  const payload = (await cloudResponse.json().catch(() => null)) as
    | {
        success?: boolean;
        result?: {
          id?: string;
          uploadURL?: string;
        };
      }
    | null;

  if (
    !cloudResponse.ok ||
    !payload?.success ||
    !payload.result?.uploadURL ||
    !payload.result?.id
  ) {
    return res.status(502).json({
      success: false,
      error: "이미지 업로드 URL을 가져오지 못했습니다.",
    });
  }

  res.json({
    success: true,
    ...payload.result,
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
