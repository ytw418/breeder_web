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
          background: "linear-gradient(135deg, #0B1327 0%, #162446 54%, #1E5BFF 100%)",
          color: "white",
          fontFamily: "Inter, Pretendard, sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -110,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "rgba(125, 229, 255, 0.18)",
            filter: "blur(36px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 20,
            bottom: -140,
            width: 360,
            height: 300,
            borderRadius: 9999,
            background: "rgba(253, 224, 71, 0.15)",
            filter: "blur(32px)",
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "64px 70px",
            gap: 36,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                borderRadius: 9999,
                padding: "8px 18px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: -0.3,
              }}
            >
              BREDY AUCTION TOOL
            </div>

            <div
              style={{
                marginTop: 32,
                fontSize: 72,
                lineHeight: 1.1,
                letterSpacing: -1.5,
                fontWeight: 800,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>30초면 만드는</span>
              <span>링크형 경매 도구</span>
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 30,
                lineHeight: 1.35,
                color: "#D8E7FF",
                letterSpacing: -0.3,
              }}
            >
              카카오 로그인 기반 참여 · 자동 연장 · 신고/제재 처리
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
              <div
                style={{
                  height: 68,
                  minWidth: 260,
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 28px",
                  fontSize: 30,
                  fontWeight: 800,
                  color: "#171717",
                  background: "#FEE500",
                }}
              >
                카카오로 시작
              </div>
              <div
                style={{
                  height: 68,
                  minWidth: 210,
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 24px",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.26)",
                }}
              >
                경매 보기
              </div>
            </div>

            <div
              style={{
                marginTop: 26,
                display: "flex",
                gap: 14,
              }}
            >
              {["입찰 검증", "자동 연장", "신고 처리"].map((label) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 9999,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    fontSize: 22,
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
              width: 320,
              height: 470,
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "linear-gradient(165deg, rgba(255,255,255,0.22), rgba(255,255,255,0.07))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 26,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 20,
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#19306F",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.6 }}>
                실시간 경매
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#425C9A" }}>
                호가 단위 자동
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#425C9A" }}>
                마감 임박 연장
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#6B82B9" }}>
                신고/제재 로그
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
