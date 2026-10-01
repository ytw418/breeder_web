import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { hasAdminAccess } from "@libs/server/adminAccess";
import { isDeletedUserName } from "@libs/shared/deletedUser";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  try {
    if (req.method === "GET") {
      const profile = await client.user.findUnique({
        where: { id: req.user?.id },
      });
      const isAdmin = profile ? await hasAdminAccess(profile.id) : false;

      // console.log("profile :>> ", profile);
      res.json({
        success: true,
        profile,
        isAdmin,
      });
    }
    if (req.method === "POST") {
      const {
        user,
        body: { name, avatarId },
      } = req;

      if (name) {
        // 탈퇴 유저 표시용 이름은 사칭 방지를 위해 막는다.
        if (isDeletedUserName(name)) {
          return res.json({ success: false, error: "사용할 수 없는 닉네임입니다." });
        }

        // 닉네임 중복검사
        const checkName = await client.user.findUnique({
          where: { name: name },
        });

        if (checkName) {
          return res.json({ success: false, error: "중복된 닉네임입니다." });
        }

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
    const message =
      error instanceof Error ? error.message : "서버 내부 오류가 발생했습니다.";
    res.json({ success: false, error: message });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
