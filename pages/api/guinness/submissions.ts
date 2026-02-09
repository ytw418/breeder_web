import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import {
  GuinnessRecordType,
  GuinnessSubmission,
  readGuinnessSubmissions,
  writeGuinnessSubmissions,
} from "@libs/server/guinness-submissions";

export type { GuinnessSubmission } from "@libs/server/guinness-submissions";

export interface GuinnessSubmissionsResponse extends ResponseType {
  submissions?: GuinnessSubmission[];
  submission?: GuinnessSubmission;
}

const RECORD_TYPES: GuinnessRecordType[] = ["size", "weight"];
const PHONE_REGEX = /^[0-9+\-\s()]{8,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLA_HOURS = 72;

const getSlaDueAt = (base: string) =>
  new Date(new Date(base).getTime() + SLA_HOURS * 60 * 60 * 1000).toISOString();

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GuinnessSubmissionsResponse>
) {
  const {
    session: { user },
  } = req;

  if (!user?.id) {
    return res
      .status(401)
      .json({ success: false, error: "로그인이 필요한 요청입니다." });
  }

  if (req.method === "GET") {
    const submissions = await readGuinnessSubmissions();
    const mine = submissions
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    return res.json({ success: true, submissions: mine });
  }

  if (req.method === "POST") {
    const { action = "submit" } = req.body;
    const {
      id,
      species,
      recordType,
      value,
      description,
      proofPhotos,
      contactPhone,
      contactEmail,
      measurementDate,
      consentToContact,
    } = req.body;

    const normalizedSpecies = String(species || "").trim();
    const normalizedRecordType = String(recordType || "").trim() as GuinnessRecordType;
    const normalizedValue = Number(value);
    const normalizedDescription = String(description || "").trim();
    const normalizedPhone = String(contactPhone || "").trim();
    const normalizedEmail = String(contactEmail || "").trim();
    const normalizedMeasurementDate = String(measurementDate || "").trim();
    const normalizedProofPhotos = Array.isArray(proofPhotos)
      ? proofPhotos.filter((photo) => typeof photo === "string" && photo.trim())
      : [];
    const hasConsent = Boolean(consentToContact);

    if (!normalizedSpecies || !RECORD_TYPES.includes(normalizedRecordType)) {
      return res.status(400).json({
        success: false,
        error: "종명과 기록 타입을 올바르게 입력해주세요.",
      });
    }

    if (Number.isNaN(normalizedValue) || normalizedValue <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "측정값을 올바르게 입력해주세요." });
    }

    if (!normalizedProofPhotos.length) {
      return res
        .status(400)
        .json({ success: false, error: "증빙 사진을 최소 1장 첨부해주세요." });
    }

    if (!normalizedPhone && !normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: "전화번호 또는 이메일 중 하나는 반드시 입력해주세요.",
      });
    }

    if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      return res
        .status(400)
        .json({ success: false, error: "전화번호 형식이 올바르지 않습니다." });
    }

    if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
      return res
        .status(400)
        .json({ success: false, error: "이메일 형식이 올바르지 않습니다." });
    }

    if (!hasConsent) {
      return res.status(400).json({
        success: false,
        error: "심사 연락 및 개인정보 처리 동의가 필요합니다.",
      });
    }

    let parsedMeasurementDate: string | null = null;
    if (normalizedMeasurementDate) {
      const measurement = new Date(normalizedMeasurementDate);
      if (Number.isNaN(measurement.getTime())) {
        return res
          .status(400)
          .json({ success: false, error: "측정일 형식이 올바르지 않습니다." });
      }

      const nowDate = new Date();
      if (measurement.getTime() > nowDate.getTime()) {
        return res
          .status(400)
          .json({ success: false, error: "미래 날짜는 측정일로 선택할 수 없습니다." });
      }
      parsedMeasurementDate = measurement.toISOString();
    }

    const me = await client.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true },
    });

    if (!me) {
      return res
        .status(404)
        .json({ success: false, error: "사용자 정보를 찾을 수 없습니다." });
    }

    const submissions = await readGuinnessSubmissions();

    if (action === "resubmit") {
      const submissionId = Number(id);
      if (!submissionId) {
        return res
          .status(400)
          .json({ success: false, error: "재신청할 신청 id가 필요합니다." });
      }

      const target = submissions.find((item) => item.id === submissionId);
      if (!target || target.userId !== me.id) {
        return res
          .status(404)
          .json({ success: false, error: "재신청 대상을 찾을 수 없습니다." });
      }

      if (target.status !== "rejected") {
        return res.status(400).json({
          success: false,
          error: "반려된 신청만 수정 후 재신청할 수 있습니다.",
        });
      }

      const hasSamePending = submissions.some(
        (item) =>
          item.id !== submissionId &&
          item.userId === me.id &&
          item.status === "pending" &&
          item.species === normalizedSpecies &&
          item.recordType === normalizedRecordType
      );
      if (hasSamePending) {
        return res.status(400).json({
          success: false,
          error: "해당 항목은 심사 진행 중입니다. 결과 확인 후 다시 신청해주세요.",
        });
      }

      const now = new Date().toISOString();
      const updated: GuinnessSubmission = {
        ...target,
        species: normalizedSpecies,
        recordType: normalizedRecordType,
        value: normalizedValue,
        measurementDate: parsedMeasurementDate,
        description: normalizedDescription || null,
        proofPhotos: normalizedProofPhotos,
        contactPhone: normalizedPhone || null,
        contactEmail: normalizedEmail || null,
        consentToContact: hasConsent,
        submittedAt: now,
        slaDueAt: getSlaDueAt(now),
        resubmitCount: (target.resubmitCount || 0) + 1,
        status: "pending",
        reviewReasonCode: null,
        reviewMemo: null,
        reviewedBy: null,
        reviewedAt: null,
        approvedRecordId: null,
        updatedAt: now,
      };

      const nextItems = submissions.map((item) =>
        item.id === updated.id ? updated : item
      );
      await writeGuinnessSubmissions(nextItems);
      return res.json({ success: true, submission: updated });
    }

    if (action !== "submit") {
      return res
        .status(400)
        .json({ success: false, error: "지원하지 않는 action 입니다." });
    }

    const hasSamePending = submissions.some(
      (item) =>
        item.userId === me.id &&
        item.status === "pending" &&
        item.species === normalizedSpecies &&
        item.recordType === normalizedRecordType
    );
    if (hasSamePending) {
      return res.status(400).json({
        success: false,
        error: "해당 항목은 심사 진행 중입니다. 결과 확인 후 다시 신청해주세요.",
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = submissions.filter(
      (item) =>
        item.userId === me.id &&
        new Date(item.createdAt).getTime() >= startOfToday.getTime()
    ).length;
    if (todayCount >= 3) {
      return res.status(400).json({
        success: false,
        error: "하루 신청 한도(3건)를 초과했습니다. 내일 다시 신청해주세요.",
      });
    }

    const now = new Date().toISOString();

    const submission: GuinnessSubmission = {
      id: Date.now(),
      userId: me.id,
      userName: me.name,
      species: normalizedSpecies,
      recordType: normalizedRecordType,
      value: normalizedValue,
      measurementDate: parsedMeasurementDate,
      description: normalizedDescription || null,
      proofPhotos: normalizedProofPhotos,
      contactPhone: normalizedPhone || null,
      contactEmail: normalizedEmail || null,
      consentToContact: hasConsent,
      submittedAt: now,
      slaDueAt: getSlaDueAt(now),
      resubmitCount: 0,
      status: "pending",
      reviewReasonCode: null,
      reviewMemo: null,
      reviewedBy: null,
      reviewedAt: null,
      approvedRecordId: null,
      createdAt: now,
      updatedAt: now,
    };

    await writeGuinnessSubmissions([...submissions, submission]);
    return res.json({ success: true, submission });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: true,
    handler,
  })
);
