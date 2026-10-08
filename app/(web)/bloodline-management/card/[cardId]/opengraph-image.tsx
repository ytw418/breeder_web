import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  bloodlineOgReceivedLine,
  bloodlineOgSpeciesLine,
  loadBloodlineOgPayload,
  loadBloodlineOgPhoto,
  type BloodlineOgPayload,
} from "@libs/server/bloodline-og";
import RootOpenGraphImage from "../../../../opengraph-image";

/**
 * 혈통 공유 미리보기 이미지(PRD S-10, 설계 §3.9). URL: /bloodline-management/card/{id}/opengraph-image
 * - 흰 배경, 왼쪽 480×630 사진(없으면 #E9EBEE), 오른쪽 이름·종·산지·만든 사람·받은 사람 수, 하단 로고 + bredy.app.
 * - 주황은 왼쪽 가장자리 8px 세로 바 하나. 그라데이션·영문 장식 없음(design/mockups/REFERENCE.md).
 * - 공유 이미지는 밖에서 보이므로 테마와 무관한 라이트 색으로 고정한다.
 * - 회수·숨김·없는 카드와 조회 오류는 루트 기본 OG(브랜드 카드)를 그대로 돌려준다.
 */

export const runtime = "nodejs";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt = "브리디 혈통";

const BRAND = "#F97316";
const BG = "#FFFFFF";
const TEXT = "#212124";
const MUTED = "#6E737C";
const PLACEHOLDER_BG = "#E9EBEE";
const PLACEHOLDER_ICON = "#ADB1BA";

const BAR_WIDTH = 8;
const PHOTO_WIDTH = 480;
const SITE_LABEL = "bredy.app";
const ELLIPSIS = "…";

// 루트 OG(app/opengraph-image.tsx)와 같은 방식: 이미지에 쓰는 글자만 Google Fonts 에서 받아 온다.
// 실패해도 이미지는 만들어지게 폰트 없이 진행한다(next/og 기본 폰트로 대체).
async function loadKoreanFont(weight: number, text: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`
    ).then((res) => res.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((res) => res.arrayBuffer());
  } catch {
    return null;
  }
}

// 로고는 public/ 실제 파일(앱 assets/images/logo.png 와 같은 파일, REFERENCE.md 로고).
async function loadLogo() {
  try {
    const logo = await readFile(join(process.cwd(), "public/images/logo.png"));
    return `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    return null;
  }
}

function photoArea(photo: string | null) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        width={PHOTO_WIDTH}
        height={size.height}
        style={{ width: PHOTO_WIDTH, height: size.height, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  // 시안(A2-karrot.html .ph)과 같은 빈 사진 자리: 회색 면 + 1.5 라인 사진 아이콘
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: PHOTO_WIDTH,
        height: size.height,
        flexShrink: 0,
        background: PLACEHOLDER_BG,
      }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 24 24"
        fill="none"
        stroke={PLACEHOLDER_ICON}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M4 17l4.5-4.5 4 3.5 3-2.5L20 17" />
      </svg>
    </div>
  );
}

async function renderBloodlineCard(payload: BloodlineOgPayload) {
  const speciesLine = bloodlineOgSpeciesLine(payload);
  const creatorLine = `만든 사람 ${payload.creatorName}`;
  const receivedLine = bloodlineOgReceivedLine(payload);

  const allText = [payload.name, speciesLine, creatorLine, receivedLine, SITE_LABEL, ELLIPSIS].join("");
  const [regular, bold, photo, logo] = await Promise.all([
    loadKoreanFont(400, allText),
    loadKoreanFont(700, allText),
    loadBloodlineOgPhoto(payload.imageId),
    loadLogo(),
  ]);

  const fonts = [
    regular && { name: "NotoSansKR", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "NotoSansKR", data: bold, weight: 700 as const, style: "normal" as const },
  ].filter((font): font is NonNullable<typeof font> => Boolean(font));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          color: TEXT,
          fontFamily: "NotoSansKR, sans-serif",
        }}
      >
        <div style={{ display: "flex", width: BAR_WIDTH, height: size.height, flexShrink: 0, background: BRAND }} />
        {photoArea(photo)}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "64px 64px 56px 64px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "block",
                lineClamp: 2,
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: -1.2,
                color: TEXT,
              }}
            >
              {payload.name}
            </div>
            {speciesLine ? (
              <div style={{ display: "flex", marginTop: 20, fontSize: 32, lineHeight: 1.3, color: MUTED }}>
                {speciesLine}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 12 }}>
              <div style={{ display: "flex", fontSize: 28, lineHeight: 1.3, color: TEXT }}>{creatorLine}</div>
              <div style={{ display: "flex", fontSize: 28, lineHeight: 1.3, color: TEXT }}>{receivedLine}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logo ? <img src={logo} alt="" width={44} height={44} style={{ width: 44, height: 44 }} /> : null}
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{SITE_LABEL}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}

export default async function BloodlineOpenGraphImage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const id = Number(cardId);

  let payload: BloodlineOgPayload | null = null;
  try {
    payload = await loadBloodlineOgPayload(id);
  } catch (error) {
    console.warn("[bloodline-og] 미리보기 이미지 조회 실패", error);
  }
  if (!payload) return RootOpenGraphImage();

  return renderBloodlineCard(payload);
}
