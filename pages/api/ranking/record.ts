import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";

/** 기록 등록 응답 타입 */
export interface CreateRecordResponse {
  success: boolean;
  error?: string;
  isNewRecord?: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    session: { user },
    body: { species, recordType, value, photo, description },
  } = req;

  if (!user?.id) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }

  // 유효성 검사
  if (!species || !recordType || !value || !photo) {
    return res.status(400).json({ success: false, error: "필수 항목을 모두 입력해주세요." });
  }

  if (!["size", "weight"].includes(recordType)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 기록 타입입니다." });
  }

  const numValue = Number(value);
  if (isNaN(numValue) || numValue <= 0) {
    return res.status(400).json({ success: false, error: "측정값이 올바르지 않습니다." });
  }

  try {
    // 현재 최고 기록 조회
    const currentRecord = await client.insectRecord.findFirst({
      where: { species, recordType },
      orderBy: { value: "desc" },
    });

    const isNewRecord = !currentRecord || numValue > currentRecord.value;

    // 기록 등록
    const record = await client.insectRecord.create({
      data: {
        species,
        recordType,
        value: numValue,
        photo,
        description: description || null,
        user: { connect: { id: user.id } },
      },
    });

    // 신기록일 경우 알림 (기존 기록 보유자에게)
    if (isNewRecord && currentRecord && currentRecord.userId !== user.id) {
      const bidder = await client.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });

      if (bidder) {
        createNotification({
          type: "NEW_RECORD",
          userId: currentRecord.userId,
          senderId: user.id,
          message: `${bidder.name}님이 ${species} ${recordType === "size" ? "크기" : "무게"} 부문에서 새 기록(${numValue}${recordType === "size" ? "mm" : "g"})을 세웠습니다!`,
          targetId: record.id,
          targetType: "record",
        });
      }
    }

    return res.json({
      success: true,
      isNewRecord,
    });
  } catch (error) {
    console.error("Record create error:", error);
    return res.status(500).json({ success: false, error: "기록 등록 중 오류가 발생했습니다." });
  }
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);
