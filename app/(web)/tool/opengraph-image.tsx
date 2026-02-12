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
          padding: "56px 62px",
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
            background: "rgba(125, 229, 255, 0.18)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -100,
            bottom: -120,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "rgba(250, 204, 21, 0.16)",
            filter: "blur(34px)",
          }}
        />

        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 34,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.12)",
                padding: "8px 16px",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              BREDY TOOL
            </div>

            <div
              style={{
                marginTop: 26,
                display: "flex",
                flexDirection: "column",
                fontSize: 62,
                lineHeight: 1.1,
                letterSpacing: -1.1,
                fontWeight: 800,
              }}
            >
              <span>1분 만에 만드는</span>
              <span>경매 폼 생성기</span>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                fontSize: 28,
                lineHeight: 1.35,
                color: "#d8e7ff",
              }}
            >
              로그인 후 경매 등록, 공유 링크 발급
              <br />
              입찰 참여까지 간단하게 연결
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              {["경매 등록", "링크 공유", "알림 확인"].map((label) => (
                <div
                  key={label}
                  style={{
                    borderRadius: 9999,
                    border: "1px solid rgba(255,255,255,0.24)",
                    background: "rgba(255,255,255,0.12)",
                    padding: "9px 14px",
                    fontSize: 20,
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
              width: 276,
              height: 356,
              borderRadius: 26,
              border: "1px solid rgba(255,255,255,0.24)",
              background:
                "linear-gradient(168deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))",
              padding: 16,
              display: "flex",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 20,
                background: "rgba(255,255,255,0.94)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#1d4ed8",
                gap: 9,
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 800 }}>BREDY</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#334155" }}>
                TOOL
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#334155" }}>
                AUCTION FORM
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#475569" }}>
                경량 경매 운영 흐름
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
