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
          backgroundColor: "#0F172A",
          color: "#F8FAFC",
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            borderRadius: 28,
            border: "1px solid #334155",
            backgroundColor: "#111827",
            padding: 44,
            gap: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                borderRadius: 9999,
                backgroundColor: "#1E293B",
                border: "1px solid #334155",
                padding: "8px 16px",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              BREDY AUCTION
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 26,
                fontSize: 70,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: -1.2,
              }}
            >
              <span>진행중 경매</span>
              <span>브리디 경매도구</span>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 30,
                color: "#CBD5E1",
              }}
            >
              30초면 만드는 링크형 경매 도구
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 24,
              }}
            >
              {["카카오 로그인", "실시간 입찰", "자동 연장"].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    borderRadius: 9999,
                    border: "1px solid #334155",
                    backgroundColor: "#1E293B",
                    padding: "10px 16px",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#E2E8F0",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              width: 280,
              borderRadius: 22,
              backgroundColor: "#F8FAFC",
              color: "#0F172A",
              border: "1px solid #CBD5E1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>BREDY</div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>AUCTION TOOL</div>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 600, color: "#334155" }}>
              공유형 경매 도구
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
