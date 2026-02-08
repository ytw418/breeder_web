import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

export interface ReadResponse {
  success: boolean;
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReadResponse>
) {
  try {
    const {
      query: { chatRoomId },
      session: { user },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    // lastReadAt을 현재 시간으로 업데이트
    await client.chatRoomMember.updateMany({
      where: {
        chatRoomId: +chatRoomId!,
        userId: user.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    // 불필요한 재조회 없이 바로 성공 응답
    return res.json({ success: true });
  } catch (error) {
    console.error("Error in read handler:", error);
    return res
      .status(500)
      .json({ success: false, error: "서버 오류가 발생했습니다." });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
