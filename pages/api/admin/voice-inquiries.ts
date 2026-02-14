import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { hasAdminAccess } from "./_utils";
import { VoiceInquiryStatus, VoiceInquiryType } from "@prisma/client";

interface VoiceInquiryAdminItem {
  id: number;
  type: VoiceInquiryType;
  status: VoiceInquiryStatus;
  title: string;
  description: string;
  contactEmail: string;
  requesterId: number | null;
  requesterName: string | null;
  adminNote: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface VoiceInquiryAdminResponse extends ResponseType {
  inquiries: VoiceInquiryAdminItem[];
  counts: Record<VoiceInquiryStatus, number>;
  error?: string;
}

const STATUS_SET = new Set<VoiceInquiryStatus>([
  "OPEN",
  "IN_REVIEW",
  "DONE",
  "REJECTED",
]);
const TYPE_SET = new Set<VoiceInquiryType>([
  "BUG_REPORT",
  "FEATURE_REQUEST",
  "DEV_TEAM_REQUEST",
]);

const EMPTY_COUNTS: Record<VoiceInquiryStatus, number> = {
  OPEN: 0,
  IN_REVIEW: 0,
  DONE: 0,
  REJECTED: 0,
};

async function getCounts() {
  const grouped = await client.voiceInquiry.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return grouped.reduce<Record<VoiceInquiryStatus, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, { ...EMPTY_COUNTS });
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceInquiryAdminResponse>
) {
  const adminId = req.session.user?.id;
  const isAdmin = await hasAdminAccess(adminId);
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: "접근 권한이 없습니다.",
      inquiries: [],
      counts: EMPTY_COUNTS,
    });
  }

  if (req.method === "GET") {
    const status = String(req.query.status || "ALL");
    const type = String(req.query.type || "ALL");

    const where = {
      ...(status === "ALL" || !STATUS_SET.has(status as VoiceInquiryStatus)
        ? {}
        : { status: status as VoiceInquiryStatus }),
      ...(type === "ALL" || !TYPE_SET.has(type as VoiceInquiryType)
        ? {}
        : { type: type as VoiceInquiryType }),
    };

    const [inquiries, counts] = await Promise.all([
      client.voiceInquiry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      getCounts(),
    ]);

    return res.json({
      success: true,
      inquiries,
      counts,
    });
  }

  if (req.method === "POST") {
    const { id, status, adminNote } = req.body || {};
    const inquiryId = Number(id);
    const nextStatus = String(status || "") as VoiceInquiryStatus;
    const nextAdminNote = String(adminNote || "").trim().slice(0, 500);

    if (!inquiryId || Number.isNaN(inquiryId)) {
      return res.status(400).json({
        success: false,
        error: "유효한 문의 ID가 필요합니다.",
        inquiries: [],
        counts: EMPTY_COUNTS,
      });
    }

    if (!STATUS_SET.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 상태값입니다.",
        inquiries: [],
        counts: EMPTY_COUNTS,
      });
    }

    const exists = await client.voiceInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true },
    });
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: "문의를 찾을 수 없습니다.",
        inquiries: [],
        counts: EMPTY_COUNTS,
      });
    }

    const updated = await client.voiceInquiry.update({
      where: { id: inquiryId },
      data: {
        status: nextStatus,
        adminNote: nextAdminNote || null,
      },
    });

    const counts = await getCounts();

    return res.json({
      success: true,
      inquiries: [updated],
      counts,
    });
  }

  return res.status(405).json({
    success: false,
    error: "지원하지 않는 메서드입니다.",
    inquiries: [],
    counts: EMPTY_COUNTS,
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
