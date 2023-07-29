import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { UniqueName } from "@libs/server/UniqueName";

export interface LoginReqBody {
  snsId: string;
  name: string;
  provider: "kakao" | "google" | "apple";
  email?: string | null;
  avatar?: string;
}

export interface LoginResponseType {
  success: boolean;
  error?: string;
  user: {
    id: number;
    snsId: string;
    provider: string;
    phone: string | null;
    email: string | null;
    name: string;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const { snsId, email, provider, name, avatar } = req.body;
  console.log("body :>> ", req.body);
  // return res.end("end");

  if (!snsId)
    return res
      .status(400)
      .json({ success: false, message: "snsId is required for login." });
  if (!name)
    return res
      .status(400)
      .json({ success: false, message: "name is required for login." });
  if ((provider && "kakao") | (provider && "google") | (provider && "apple"))
    return res
      .status(400)
      .json({ success: false, message: "provider is required for login." });

  try {
    // Prisma를 사용하여 해당 snsId로 사용자 찾기
    let user = await client.user.findUnique({
      where: { snsId },
    });

    if (!user) {
      // 해당 이메일의 사용자가 존재하지 않는 경우 새로운 사용자 생성
      const uniqueName = await UniqueName();
      user = await client.user.create({
        data: {
          snsId,
          email,
          name: uniqueName,
          provider,
          avatar,
        },
      });
    }
    console.log("user :>> ", user);
    req.session.user = user;
    await req.session.save();
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("로그인 중 오류 발생:", error);
    res
      .status(500)
      .json({ success: false, error: "로그인 중 오류가 발생했습니다." });
  }
}
export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: false })
);
