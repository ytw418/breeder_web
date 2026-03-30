import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { hasAdminAccess } from "./_utils";
import {
  BREEDER_PROGRAM_FRAME_VARIANTS,
  BREEDER_PROGRAM_LABELS,
  isBreederProgramType,
  type BreederProgramType,
} from "@libs/shared/breeder-program";
import { getSortedActiveBreederProgramSummaries } from "@libs/server/breeder-programs";

const SEARCH_LIMIT = 20;
const MEMBERSHIP_LIMIT = 50;
type ProgramFilter = BreederProgramType | "ALL";

const normalizeSearch = (value: unknown) => String(value || "").trim();

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
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
    const search = normalizeSearch(req.query.search);
    const programTypeParam = normalizeSearch(req.query.programType) as ProgramFilter | "";
    if (programTypeParam && programTypeParam !== "ALL" && !isBreederProgramType(programTypeParam)) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 programType 값입니다.",
      });
    }
    const membershipWhere =
      programTypeParam && programTypeParam !== "ALL"
        ? { status: "ACTIVE" as const, programType: programTypeParam }
        : { status: "ACTIVE" as const };

    const [memberships, users] = await Promise.all([
      client.breederProgramMembership.findMany({
        where: membershipWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ grantedAt: "desc" }],
        take: MEMBERSHIP_LIMIT,
      }),
      search
        ? client.user.findMany({
            where: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
            include: {
              breederPrograms: {
                where: { status: "ACTIVE" },
                select: {
                  id: true,
                  programType: true,
                  status: true,
                  source: true,
                  badgeLabel: true,
                  frameVariant: true,
                  foundingNo: true,
                  feeBenefitType: true,
                  feeDiscountPercent: true,
                  grantedAt: true,
                  revokedAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: SEARCH_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    return res.json({
      success: true,
      memberships: memberships.map((item) => ({
        id: item.id,
        userId: item.userId,
        programType: item.programType,
        status: item.status,
        source: item.source,
        badgeLabel: item.badgeLabel,
        frameVariant: item.frameVariant,
        foundingNo: item.foundingNo,
        feeBenefitType: item.feeBenefitType,
        feeDiscountPercent: item.feeDiscountPercent,
        grantedAt: item.grantedAt.toISOString(),
        revokedAt: item.revokedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        user: {
          ...item.user,
          createdAt: item.user.createdAt.toISOString(),
        },
      })),
      users: users.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        avatar: item.avatar,
        createdAt: item.createdAt.toISOString(),
        breederPrograms: getSortedActiveBreederProgramSummaries(item.breederPrograms),
      })),
    });
  }

  if (req.method === "POST") {
    const { action } = req.body as { action?: string };
    if (!action) {
      return res
        .status(400)
        .json({ success: false, error: "action 값이 필요합니다." });
    }

    if (action === "upsert_partner_program") {
      const userId = Number(req.body?.userId);
      const feeDiscountPercent = Number(req.body?.feeDiscountPercent);
      if (!userId || Number.isNaN(userId)) {
        return res
          .status(400)
          .json({ success: false, error: "유저 ID가 필요합니다." });
      }
      if (
        Number.isNaN(feeDiscountPercent) ||
        feeDiscountPercent <= 0 ||
        feeDiscountPercent > 100
      ) {
        return res.status(400).json({
          success: false,
          error: "할인율은 1~100 사이 숫자여야 합니다.",
        });
      }

      const targetUser = await client.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, error: "대상 유저를 찾을 수 없습니다." });
      }

      const membership = await client.breederProgramMembership.upsert({
        where: {
          userId_programType: {
            userId,
            programType: "PARTNER_BREEDER",
          },
        },
        create: {
          userId,
          programType: "PARTNER_BREEDER",
          status: "ACTIVE",
          source: "MANUAL_ADMIN",
          badgeLabel: BREEDER_PROGRAM_LABELS.PARTNER_BREEDER,
          frameVariant: BREEDER_PROGRAM_FRAME_VARIANTS.PARTNER_BREEDER,
          feeBenefitType: "AUCTION_FEE_PERCENT_DISCOUNT",
          feeDiscountPercent,
        },
        update: {
          status: "ACTIVE",
          revokedAt: null,
          source: "MANUAL_ADMIN",
          badgeLabel: BREEDER_PROGRAM_LABELS.PARTNER_BREEDER,
          frameVariant: BREEDER_PROGRAM_FRAME_VARIANTS.PARTNER_BREEDER,
          feeBenefitType: "AUCTION_FEE_PERCENT_DISCOUNT",
          feeDiscountPercent,
        },
      });

      return res.json({
        success: true,
        membership: {
          id: membership.id,
          userId: membership.userId,
          programType: membership.programType,
        },
      });
    }

    if (action === "revoke_program") {
      const userId = Number(req.body?.userId);
      const programType = normalizeSearch(req.body?.programType) as BreederProgramType;

      if (!userId || Number.isNaN(userId) || !programType) {
        return res.status(400).json({
          success: false,
          error: "유저 ID와 programType이 필요합니다.",
        });
      }

      if (programType !== "PARTNER_BREEDER") {
        return res.status(400).json({
          success: false,
          error: "현재는 파트너 브리더만 수동 철회할 수 있습니다.",
        });
      }

      const membership = await client.breederProgramMembership.findUnique({
        where: {
          userId_programType: {
            userId,
            programType,
          },
        },
        select: { id: true },
      });
      if (!membership) {
        return res
          .status(404)
          .json({ success: false, error: "대상 멤버십을 찾을 수 없습니다." });
      }

      await client.breederProgramMembership.update({
        where: { id: membership.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
        },
      });

      return res.json({ success: true });
    }

    return res
      .status(400)
      .json({ success: false, error: "지원하지 않는 action입니다." });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
