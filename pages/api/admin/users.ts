import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { issueTokens, toAuthUser } from "@libs/server/jwt";
import client from "@libs/server/client";
import { role as UserRole, UserStatus } from "@prisma/client";
import { canRunSensitiveAdminAction, hasAdminAccess } from "@libs/server/adminAccess";
import { randomUUID } from "crypto";
import { deleteAccount } from "@libs/server/accountDeletion";
import { setUserStatus } from "@libs/server/accountStatus";

const ROLE_OPTIONS: UserRole[] = ["USER", "FAKE_USER", "ADMIN", "SUPER_USER"];
const STATUS_OPTIONS: UserStatus[] = [
  "ACTIVE",
  "BANNED",
  "SUSPENDED_7D",
  "SUSPENDED_30D",
  "DELETED",
];

/**
 * 탈퇴 처리는 snsId 를 해시로 바꾸고 30일 뒤 원문을 파기해, 차단 계정이 같은 소셜 계정으로 재가입할 수 있게 된다.
 * 차단을 유지하려면 차단 계정은 탈퇴 처리하지 않는다(필요하면 먼저 ACTIVE 로 바꾼 뒤 처리).
 */
const BANNED_DELETE_ERROR =
  "차단된 계정은 탈퇴 처리할 수 없어요. 탈퇴 처리하면 30일 뒤 같은 소셜 계정으로 다시 가입할 수 있어요.";

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    user,
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
      const currentAdmin = await client.user.findUnique({
        where: { id: user?.id },
        select: { email: true },
      });

      if (!canRunSensitiveAdminAction(currentAdmin?.email)) {
        return res.status(403).json({
          success: false,
          error:
            "관리자 권한 부여는 지정된 운영 계정(ytw418@naver.com, ytw418@gmail.com)에서만 가능합니다.",
        });
      }

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

    if (action === "switch_user_session") {
      const targetUserId = Number(userId);
      if (!targetUserId || Number.isNaN(targetUserId)) {
        return res
          .status(400)
          .json({ success: false, error: "전환할 유저 ID가 필요합니다." });
      }

      const targetUser = await client.user.findUnique({
        where: { id: targetUserId },
      });
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, error: "대상 유저를 찾을 수 없습니다." });
      }

      if (targetUser.status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          error: "비활성 계정으로는 로그인 전환할 수 없습니다.",
        });
      }

      const switchTokens = await issueTokens(
        toAuthUser(targetUser),
        targetUser.tokenVersion
      );
      return res.json({
        success: true,
        accessToken: switchTokens.accessToken,
        refreshToken: switchTokens.refreshToken,
        expiresIn: switchTokens.expiresIn,
        switchedUser: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
      });
    }

    if (action === "create_test_user") {
      const count = Math.min(Math.max(Number(req.body?.count || 1), 1), 20);
      const prefix = String(req.body?.namePrefix || "테스트유저")
        .trim()
        .slice(0, 12);

      const createdUsers: Array<{ id: number; name: string; email: string | null }> = [];

      for (let index = 0; index < count; index += 1) {
        let nickname = "";
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const suffix = `${Math.floor(Math.random() * 9000) + 1000}`;
          const candidate = `${prefix}${suffix}`;
          const exists = await client.user.findUnique({
            where: { name: candidate },
            select: { id: true },
          });
          if (!exists) {
            nickname = candidate;
            break;
          }
        }

        if (!nickname) {
          nickname = `${prefix}${Date.now().toString().slice(-4)}${index}`;
        }

        const newUser = await client.user.create({
          data: {
            snsId: `admin-test-user-${Date.now()}-${randomUUID()}-${index}`,
            provider: "test_user",
            name: nickname,
            email: null,
            role: "FAKE_USER",
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        createdUsers.push(newUser);
      }

      return res.json({
        success: true,
        createdUsers,
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

      const targetUserId = Number(userId);
      const targetUser = await client.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, status: true },
      });
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, error: "사용자를 찾을 수 없습니다." });
      }
      if (targetUser.status === "DELETED") {
        return res.status(400).json({
          success: false,
          error: "탈퇴한 계정의 상태는 변경할 수 없습니다.",
        });
      }

      // DELETED 는 상태값만 바꾸면 개인정보가 남고 재로그인도 막지 못하므로 탈퇴 처리와 같게 한다.
      if (status === "DELETED") {
        if (targetUser.status === "BANNED") {
          return res.status(400).json({ success: false, error: BANNED_DELETE_ERROR });
        }
        const result = await deleteAccount(targetUserId, {
          reason: "관리자 상태 변경",
          force: true,
        });
        if (!result.ok && result.code === "USER_NOT_FOUND") {
          return res
            .status(404)
            .json({ success: false, error: "사용자를 찾을 수 없습니다." });
        }
        return res.json({ success: true });
      }

      // 정지·차단은 tokenVersion 을 올려 대상의 모든 토큰을 즉시 끊는다.
      // 조회 뒤 탈퇴됐으면 setUserStatus 가 바꾸지 않는다.
      const applied = await setUserStatus(client, targetUserId, status);
      if (!applied) {
        return res.status(400).json({
          success: false,
          error: "탈퇴한 계정의 상태는 변경할 수 없습니다.",
        });
      }

      return res.json({ success: true });
    }

    if (action === "delete") {
      if (Number(userId) === user?.id) {
        return res
          .status(400)
          .json({ success: false, error: "현재 로그인한 계정은 삭제할 수 없습니다." });
      }

      const deleteTarget = await client.user.findUnique({
        where: { id: Number(userId) },
        select: { id: true, status: true },
      });
      if (!deleteTarget) {
        return res
          .status(404)
          .json({ success: false, error: "사용자를 찾을 수 없습니다." });
      }
      if (deleteTarget.status === "BANNED") {
        return res.status(400).json({ success: false, error: BANNED_DELETE_ERROR });
      }

      // 하드 삭제는 콘텐츠를 연쇄 삭제하고 Product(Restrict) 때문에 실패하므로 탈퇴와 같은 소프트 삭제로 처리한다.
      const result = await deleteAccount(Number(userId), {
        reason: "관리자 삭제",
        force: true,
      });
      if (!result.ok && result.code !== "ACCOUNT_ALREADY_DELETED") {
        return res
          .status(404)
          .json({ success: false, error: "사용자를 찾을 수 없습니다." });
      }

      return res.json({ success: true });
    }

    return res
      .status(400)
      .json({ success: false, error: "지원하지 않는 action 입니다." });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
