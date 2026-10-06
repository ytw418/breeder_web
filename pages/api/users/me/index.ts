import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { hasAdminAccess } from "@libs/server/adminAccess";
import { checkNickname, isUniqueNameError } from "@libs/server/nickname";
import { NICKNAME_TAKEN_MESSAGE } from "@libs/shared/nickname";
import {
  INVALID_REGION_MESSAGE,
  REGION_REQUIRED_MESSAGE,
  isValidRegion,
} from "@libs/shared/regions";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  try {
    if (req.method === "GET") {
      // 토큰 무효화·정지 만료 같은 서버 내부 필드는 내려주지 않는다.
      const profile = await client.user.findUnique({
        where: { id: req.user?.id },
        omit: { tokenVersion: true, suspendedUntil: true },
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
        body: { name, avatarId, regionSido, regionSigungu, regionVisible },
      } = req;
      const body = (req.body ?? {}) as Record<string, unknown>;

      // 내 동네: 두 값을 함께 보낸다. 둘 다 null 이면 해제(노출도 같이 끈다), 목록에 없는 조합은 400.
      const hasRegion = "regionSido" in body || "regionSigungu" in body;
      if (hasRegion) {
        if (regionSido == null && regionSigungu == null) {
          await client.user.update({
            where: { id: user?.id },
            data: {
              regionSido: null,
              regionSigungu: null,
              regionVisible: false,
              regionUpdatedAt: new Date(),
            },
          });
        } else if (!isValidRegion(regionSido, regionSigungu)) {
          return res.status(400).json({
            success: false,
            error: INVALID_REGION_MESSAGE,
            errorCode: "INVALID_REGION",
          });
        } else {
          await client.user.update({
            where: { id: user?.id },
            data: { regionSido, regionSigungu, regionUpdatedAt: new Date() },
          });
        }
      }

      // 동네 브리더 노출(opt-in). 켜려면 동네가 있어야 한다.
      if (typeof regionVisible === "boolean") {
        const clearing = hasRegion && regionSido == null && regionSigungu == null;
        if (regionVisible && !clearing) {
          const current = hasRegion
            ? { regionSigungu }
            : await client.user.findUnique({
                where: { id: user?.id },
                select: { regionSigungu: true },
              });
          if (!current?.regionSigungu) {
            return res.status(400).json({
              success: false,
              error: REGION_REQUIRED_MESSAGE,
              errorCode: "REGION_REQUIRED",
            });
          }
        }
        if (!clearing) {
          await client.user.update({
            where: { id: user?.id },
            data: { regionVisible },
          });
        }
      }

      if (name != null) {
        // 형식(공백·길이·예약어)과 중복을 한 번에 검사한다. 본인의 현재 닉네임은 사용 가능.
        const nickname = await checkNickname(name, user!.id);
        if (!nickname.available) {
          return res.json({ success: false, error: nickname.reason });
        }

        if (!nickname.isCurrent) {
          try {
            await client.user.update({
              where: {
                id: user?.id,
              },
              data: {
                name: nickname.name,
              },
            });
          } catch (error) {
            // 검사 뒤 다른 유저가 같은 이름을 먼저 저장한 경우
            if (isUniqueNameError(error)) {
              return res.json({ success: false, error: NICKNAME_TAKEN_MESSAGE });
            }
            throw error;
          }
        }
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
    console.error("users.me.error", error);
    // Prisma 오류 메시지(쿼리·스키마 정보)를 클라이언트에 노출하지 않는다.
    res.json({ success: false, error: "프로필 저장에 실패했습니다." });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
