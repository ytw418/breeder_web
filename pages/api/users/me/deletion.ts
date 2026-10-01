import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import { withAuth } from "@libs/server/auth";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  ACCOUNT_DELETION_RETENTION_DAYS,
  deleteAccount,
  findDeletionBlockers,
} from "@libs/server/accountDeletion";

const ADMIN_BLOCK_MESSAGE =
  "관리자 계정은 직접 탈퇴할 수 없습니다. 다른 관리자에게 요청해 주세요.";

/**
 * GET  /api/users/me/deletion — 탈퇴 가능 여부와 막는 사유(진행 중 경매·거래)
 * POST /api/users/me/deletion — 탈퇴 실행 { reason?: string }
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user!.id;
  const isAdmin = await hasAdminAccess(userId);

  if (req.method === "GET") {
    const blockers = await findDeletionBlockers(userId);
    return res.json({
      success: true,
      eligible: !isAdmin && blockers.length === 0,
      purgeAfterDays: ACCOUNT_DELETION_RETENTION_DAYS,
      blockers,
      ...(isAdmin
        ? { errorCode: "ADMIN_ACCOUNT_CANNOT_SELF_DELETE", message: ADMIN_BLOCK_MESSAGE }
        : {}),
    });
  }

  if (isAdmin) {
    return res.status(403).json({
      success: false,
      errorCode: "ADMIN_ACCOUNT_CANNOT_SELF_DELETE",
      message: ADMIN_BLOCK_MESSAGE,
    });
  }

  const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const result = await deleteAccount(userId, { reason });

  if (result.ok) {
    return res.json({
      success: true,
      deletedAt: result.deletedAt.toISOString(),
      purgeAt: result.purgeAt.toISOString(),
    });
  }

  if (result.code === "ACCOUNT_DELETION_BLOCKED") {
    return res.status(409).json({
      success: false,
      errorCode: result.code,
      message: "진행 중인 경매·거래를 마친 뒤 탈퇴할 수 있어요.",
      blockers: result.blockers,
    });
  }

  if (result.code === "ACCOUNT_ALREADY_DELETED") {
    return res.status(409).json({
      success: false,
      errorCode: result.code,
      message: "이미 탈퇴한 계정입니다.",
    });
  }

  return res.status(404).json({
    success: false,
    errorCode: result.code,
    message: "계정을 찾을 수 없습니다.",
  });
}

export default withAuth(
  withHandler({ methods: ["GET", "POST"], handler, isPrivate: true })
);
