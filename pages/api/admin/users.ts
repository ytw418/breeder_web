import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { role as UserRole, UserStatus } from "@prisma/client";
import { hasAdminAccess } from "./_utils";

const ROLE_OPTIONS: UserRole[] = ["USER", "ADMIN", "SUPER_USER"];
const STATUS_OPTIONS: UserStatus[] = [
  "ACTIVE",
  "BANNED",
  "SUSPENDED_7D",
  "SUSPENDED_30D",
  "DELETED",
];

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    session: { user },
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const users = await client.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({ success: true, users });
  }

  if (req.method === "POST") {
    const { userId, action, role, email, emails } = req.body;

    if (!action) {
      return res
        .status(400)
        .json({ success: false, error: "필수 파라미터가 누락되었습니다." });
    }

    if (action === "grant_admin_by_email") {
      const candidates = Array.isArray(emails)
        ? emails
        : email
          ? [email]
          : [];

      const normalizedEmails = Array.from(
        new Set(
          candidates
            .map((item: unknown) => String(item || "").trim().toLowerCase())
            .filter((item: string) => item.includes("@"))
        )
      );

      if (!normalizedEmails.length) {
        return res
          .status(400)
          .json({ success: false, error: "유효한 이메일을 입력해주세요." });
      }

      const users = await client.user.findMany({
        where: {
          email: { in: normalizedEmails },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      const foundEmailSet = new Set(users.map((item) => item.email?.toLowerCase()).filter(Boolean));
      const notFoundEmails = normalizedEmails.filter((item) => !foundEmailSet.has(item));

      let updatedCount = 0;
      for (const target of users) {
        if (target.role === "SUPER_USER" || target.role === "ADMIN") continue;
        await client.user.update({
          where: { id: target.id },
          data: { role: "ADMIN" },
        });
        updatedCount += 1;
      }

      return res.json({
        success: true,
        updatedCount,
        foundCount: users.length,
        notFoundEmails,
      });
    }

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "유저 ID가 필요합니다." });
    }

    if (action === "update_role") {
      if (!role || !ROLE_OPTIONS.includes(role)) {
        return res
          .status(400)
          .json({ success: false, error: "유효하지 않은 권한 값입니다." });
      }

      await client.user.update({
        where: { id: Number(userId) },
        data: { role },
      });

      return res.json({ success: true });
    }

    if (action === "update_status") {
      const { status } = req.body;
      if (!status || !STATUS_OPTIONS.includes(status)) {
        return res
          .status(400)
          .json({ success: false, error: "유효하지 않은 상태 값입니다." });
      }

      if (Number(userId) === user?.id && status !== "ACTIVE") {
        return res
          .status(400)
          .json({ success: false, error: "현재 로그인한 계정은 비활성화할 수 없습니다." });
      }

      await client.user.update({
        where: { id: Number(userId) },
        data: { status },
      });

      return res.json({ success: true });
    }

    if (action === "delete") {
      if (Number(userId) === user?.id) {
        return res
          .status(400)
          .json({ success: false, error: "현재 로그인한 계정은 삭제할 수 없습니다." });
      }

      await client.user.delete({
        where: { id: Number(userId) },
      });

      return res.json({ success: true });
    }

    return res
      .status(400)
      .json({ success: false, error: "지원하지 않는 action 입니다." });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
