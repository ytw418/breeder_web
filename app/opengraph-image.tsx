import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(130deg, #0b1327 0%, #162446 56%, #1d4ed8 100%)",
          color: "#ffffff",
          fontFamily: "Inter, Pretendard, sans-serif",
          padding: "62px 68px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "rgba(125, 229, 255, 0.16)",
            filter: "blur(42px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -90,
            bottom: -130,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "rgba(250, 204, 21, 0.16)",
            filter: "blur(36px)",
          }}
        />

        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 36,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 780 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.12)",
                padding: "8px 18px",
                fontSize: 23,
                fontWeight: 700,
              }}
            >
              BREDY
            </div>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                flexDirection: "column",
                fontSize: 68,
                lineHeight: 1.1,
                letterSpacing: -1.2,
                fontWeight: 800,
              }}
            >
              <span>애완동물 서비스</span>
              <span>브리디</span>
            </div>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                flexDirection: "column",
                fontSize: 30,
                lineHeight: 1.35,
                color: "#d8e7ff",
              }}
            >
              링크형 경매 도구와 거래 기능을
              <br />
              쉽고 신뢰감 있게 시작하세요
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
              {["카카오 로그인", "자동 연장", "신고/제재 처리"].map((label) => (
                <div
                  key={label}
                  style={{
                    borderRadius: 9999,
                    border: "1px solid rgba(255,255,255,0.22)",
                    background: "rgba(255,255,255,0.12)",
                    padding: "10px 16px",
                    fontSize: 21,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              width: 260,
              height: 352,
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "linear-gradient(170deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08))",
              padding: 18,
              display: "flex",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 22,
                background: "rgba(255,255,255,0.94)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#1d4ed8",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800 }}>BREDY</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#334155" }}>경매 · 거래 · 커뮤니티</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#475569" }}>실시간 참여형 도구</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
