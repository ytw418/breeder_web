import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt = "브리디 - 브리더들의 SNS. 분양·거래·랭킹·무료경매·동네 브리더 찾기";

// 앱 브랜드 주황(#F97316, 앱 palette brand / 웹 --primary)
const BRAND = "#F97316";
const BRAND_DEEP = "#EA580C";
const BRAND_SOFT = "#FFF4EC";

const HEADLINE = "브리더들의 SNS, 브리디";
const SUBLINE = "반려동물 이야기를 나누고, 분양부터 거래까지 한 곳에서";
const FEATURES = ["분양", "거래", "랭킹", "무료경매", "동네 브리더 찾기"];

// 카톡·인스타 미리보기에서 한글이 굵게 나오도록 이미지에 쓰는 글자만 받아 온다.
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

export default async function OpenGraphImage() {
  const allText = [HEADLINE, SUBLINE, ...FEATURES, "SNS 소통", "bredy.app", "BREDY"].join("");
  const [bold, black, logo] = await Promise.all([
    loadKoreanFont(700, allText),
    loadKoreanFont(900, allText),
    readFile(join(process.cwd(), "public/images/pwa/icon-512.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  const fonts = [
    bold && { name: "NotoSansKR", data: bold, weight: 700 as const, style: "normal" as const },
    black && { name: "NotoSansKR", data: black, weight: 900 as const, style: "normal" as const },
  ].filter((font): font is NonNullable<typeof font> => Boolean(font));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(140deg, #FB923C 0%, ${BRAND} 48%, ${BRAND_DEEP} 100%)`,
          color: "#ffffff",
          fontFamily: "NotoSansKR, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -140,
            bottom: -180,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.10)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img
            src={logoSrc}
            alt=""
            width={84}
            height={84}
            style={{ borderRadius: 22, border: "4px solid rgba(255,255,255,0.9)" }}
          />
          <div
            style={{
              display: "flex",
              borderRadius: 9999,
              background: "#ffffff",
              color: BRAND_DEEP,
              padding: "10px 24px",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            SNS 소통
          </div>
        </div>

        <div
          style={{
            marginTop: 30,
            display: "flex",
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.1,
          }}
        >
          {HEADLINE}
        </div>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            fontSize: 32,
            fontWeight: 700,
            color: BRAND_SOFT,
          }}
        >
          {SUBLINE}
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 42 }}>
          {FEATURES.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.18)",
                border: "2px solid rgba(255,255,255,0.55)",
                padding: "12px 26px",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 34,
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: 1,
          }}
        >
          bredy.app
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
