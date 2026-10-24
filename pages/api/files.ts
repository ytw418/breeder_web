import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import { withAuth } from "@libs/server/auth";
import { takeUploadSlot, UPLOAD_LIMIT_MESSAGE } from "@libs/server/uploadLimit";
import { isAdminEmail } from "@libs/shared/adminEmail";

/**
 * Cloudflare direct_upload 은 가끔 일시 오류를 낸다(2026-10-21 "처음엔 업로드 URL 오류, 두 번째엔 성공").
 * 실패하면 잠깐 뒤 한 번 더 받아 보고, 실패 내용은 로그에 남긴다.
 */
const DIRECT_UPLOAD_ATTEMPTS = 2;
const DIRECT_UPLOAD_RETRY_DELAY_MS = 300;

type DirectUploadPayload = {
  success?: boolean;
  result?: {
    id?: string;
    uploadURL?: string;
  };
  errors?: unknown;
} | null;

/** 업로드 URL 하나를 받는다. 받으면 { id, uploadURL }, 못 받으면 실패 사유 문자열. */
async function requestDirectUpload(): Promise<
  { ok: true; result: { id: string; uploadURL: string } } | { ok: false; reason: string }
> {
  try {
    const cloudResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ID}/images/v1/direct_upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
      }
    );
    const payload = (await cloudResponse.json().catch(() => null)) as DirectUploadPayload;
    const id = payload?.result?.id;
    const uploadURL = payload?.result?.uploadURL;
    if (cloudResponse.ok && payload?.success && id && uploadURL) {
      return { ok: true, result: { ...payload.result, id, uploadURL } };
    }
    return {
      ok: false,
      reason: `status ${cloudResponse.status} ${JSON.stringify(payload?.errors ?? null)}`,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const user = req.user;
  if (user && !isAdminEmail(user.email) && !takeUploadSlot(user.id)) {
    return res.status(429).json({ success: false, error: UPLOAD_LIMIT_MESSAGE });
  }
  for (let attempt = 1; attempt <= DIRECT_UPLOAD_ATTEMPTS; attempt += 1) {
    const upload = await requestDirectUpload();
    if (upload.ok) {
      return res.json({
        success: true,
        ...upload.result,
      });
    }
    console.error(
      `[files] Cloudflare direct_upload 실패 (${attempt}/${DIRECT_UPLOAD_ATTEMPTS})`,
      upload.reason
    );
    if (attempt < DIRECT_UPLOAD_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, DIRECT_UPLOAD_RETRY_DELAY_MS));
    }
  }

  return res.status(502).json({
    success: false,
    error: "이미지 업로드 URL을 가져오지 못했습니다.",
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
