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
  const validProviders = ["kakao", "google", "apple"] as const;
  const normalizedEmail =
    typeof email === "string" && email.trim().length > 0
      ? email.trim().toLowerCase()
      : null;
  const normalizedAvatar =
    typeof avatar === "string" && avatar.trim().length > 0 ? avatar : null;

  if (!snsId)
    return res
      .status(400)
      .json({ success: false, message: "snsId is required for login." });
  if (!name)
    return res
      .status(400)
      .json({ success: false, message: "name is required for login." });
  if (
    typeof provider !== "string" ||
    !validProviders.includes(provider as (typeof validProviders)[number])
  )
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
          email: normalizedEmail,
          name: uniqueName,
          provider,
          avatar: normalizedAvatar,
        },
      });
    } else {
      const updateData: {
        email?: string | null;
        avatar?: string | null;
        provider?: string;
      } = {};

      // Keep social profile data fresh on subsequent logins.
      if (normalizedEmail && user.email !== normalizedEmail) {
        updateData.email = normalizedEmail;
      }
      if (normalizedAvatar && user.avatar !== normalizedAvatar) {
        updateData.avatar = normalizedAvatar;
      }
      if (user.provider !== provider) {
        updateData.provider = provider;
      }

      if (Object.keys(updateData).length > 0) {
        user = await client.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

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
