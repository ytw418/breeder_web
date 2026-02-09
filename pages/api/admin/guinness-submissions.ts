import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";
import { hasAdminAccess } from "./_utils";
import {
  GuinnessRejectionReasonCode,
  GuinnessSubmission,
  GuinnessSubmissionStatus,
} from "@libs/server/guinness-submissions";

interface AdminGuinnessSubmissionsResponse extends ResponseType {
  submissions?: GuinnessSubmission[];
  submission?: GuinnessSubmission;
  topRecordsByKey?: Record<
    string,
    {
      value: number;
      userName: string;
    }
  >;
}

const REVIEWABLE_STATUS: GuinnessSubmissionStatus[] = ["approved", "rejected"];
const REVIEW_REASON_CODES: GuinnessRejectionReasonCode[] = [
  "photo_blur",
  "measurement_not_visible",
  "contact_missing",
  "invalid_value",
  "insufficient_description",
  "suspected_manipulation",
  "other",
];

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminGuinnessSubmissionsResponse>
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
    const submissions = await client.guinnessSubmission.findMany();
    const sorted = submissions.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "pending") return -1;
        if (b.status === "pending") return 1;
      }
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

    const uniqueKeys = Array.from(
      new Set(sorted.map((item) => `${item.species}::${item.recordType}`))
    );

    let topRecordsByKey: Record<string, { value: number; userName: string }> = {};
    if (uniqueKeys.length > 0) {
      const filters = uniqueKeys.map((key) => {
        const [species, recordType] = key.split("::");
        return { species, recordType };
      });

      const topRecords = await client.insectRecord.findMany({
        where: {
          isVerified: true,
          OR: filters,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          { species: "asc" },
          { recordType: "asc" },
          { value: "desc" },
        ],
      });

      for (const record of topRecords) {
        const key = `${record.species}::${record.recordType}`;
        if (!topRecordsByKey[key]) {
          topRecordsByKey[key] = {
            value: record.value,
            userName: record.user.name,
          };
        }
      }
    }

    return res.json({ success: true, submissions: sorted, topRecordsByKey });
  }

  if (req.method === "POST") {
    const { action, id, status, reviewMemo, reviewReasonCode } = req.body;
    if (action !== "review") {
      return res
        .status(400)
        .json({ success: false, error: "지원하지 않는 action 입니다." });
    }

    const submissionId = Number(id);
    if (!submissionId) {
      return res.status(400).json({ success: false, error: "id가 필요합니다." });
    }

    const nextStatus = String(status || "") as GuinnessSubmissionStatus;
    if (!REVIEWABLE_STATUS.includes(nextStatus)) {
      return res
        .status(400)
        .json({ success: false, error: "심사 결과(status)가 올바르지 않습니다." });
    }

    const target = await client.guinnessSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!target) {
      return res
        .status(404)
        .json({ success: false, error: "신청 데이터를 찾을 수 없습니다." });
    }

    if (target.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, error: "이미 심사가 완료된 신청입니다." });
    }

    const normalizedMemo = String(reviewMemo || "").trim();
    const normalizedReasonCode = String(
      reviewReasonCode || ""
    ) as GuinnessRejectionReasonCode;
    const now = new Date();
    let approvedRecordId: number | null = null;

    if (
      nextStatus === "rejected" &&
      !REVIEW_REASON_CODES.includes(normalizedReasonCode)
    ) {
      return res.status(400).json({
        success: false,
        error: "반려 사유 템플릿을 선택해주세요.",
      });
    }

    if (nextStatus === "approved") {
      const created = await client.insectRecord.create({
        data: {
          species: target.species,
          recordType: target.recordType,
          value: target.value,
          photo: target.proofPhotos[0],
          description: target.description,
          user: { connect: { id: target.userId } },
          isVerified: true,
        },
      });
      approvedRecordId = created.id;
    }

    const updated = await client.guinnessSubmission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        reviewReasonCode: nextStatus === "rejected" ? normalizedReasonCode : null,
        reviewMemo: normalizedMemo || null,
        reviewedBy: user?.id ?? null,
        reviewedAt: now,
        approvedRecordId,
      },
    });

    if (user?.id) {
      await createNotification({
        type: "NEW_RECORD",
        userId: target.userId,
        senderId: user.id,
        message:
          nextStatus === "approved"
            ? `브리더북 신청이 승인되었습니다. (${target.species} ${target.value}${target.recordType === "size" ? "mm" : "g"})`
            : "브리더북 신청이 반려되었습니다. 심사 메모를 확인해주세요.",
        targetId: approvedRecordId || target.id,
        targetType: nextStatus === "approved" ? "record" : "guinness_submission",
      });
    }

    return res.json({ success: true, submission: updated });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
