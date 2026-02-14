import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { VoiceInquiryType } from "@prisma/client";

interface VoiceInquiryCreateResponse extends ResponseType {
  error?: string;
  inquiryId?: number;
}

const ALLOWED_TYPES = new Set<VoiceInquiryType>([
  "BUG_REPORT",
  "FEATURE_REQUEST",
  "DEV_TEAM_REQUEST",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceInquiryCreateResponse>
) {
  const { type, title, description, contactEmail } = req.body || {};
  const parsedType = String(type || "") as VoiceInquiryType;
  const parsedTitle = String(title || "").trim();
  const parsedDescription = String(description || "").trim();
  const parsedEmail = String(contactEmail || "").trim().toLowerCase();

  if (!ALLOWED_TYPES.has(parsedType)) {
    return res.status(400).json({
      success: false,
      error: "유효하지 않은 문의 유형입니다.",
    });
  }

  if (parsedTitle.length < 2 || parsedTitle.length > 80) {
    return res.status(400).json({
      success: false,
      error: "제목은 2자 이상 80자 이하로 입력해주세요.",
    });
  }

  if (parsedDescription.length < 10 || parsedDescription.length > 2000) {
    return res.status(400).json({
      success: false,
      error: "상세 내용은 10자 이상 2000자 이하로 입력해주세요.",
    });
  }

  if (!EMAIL_REGEX.test(parsedEmail)) {
    return res.status(400).json({
      success: false,
      error: "회신 받을 이메일 형식이 올바르지 않습니다.",
    });
  }

  const requesterId = req.session.user?.id || null;
  const requesterName = String(req.session.user?.name || "").trim() || null;

  const created = await client.voiceInquiry.create({
    data: {
      type: parsedType,
      title: parsedTitle,
      description: parsedDescription,
      contactEmail: parsedEmail,
      requesterId,
      requesterName,
    },
    select: { id: true },
  });

  return res.json({
    success: true,
    inquiryId: created.id,
  });
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    isPrivate: false,
    handler,
  })
);
