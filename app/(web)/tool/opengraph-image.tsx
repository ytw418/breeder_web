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
          fontFamily: "Inter, Pretendard, sans-serif",
          padding: "56px 60px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 30,
            borderRadius: 28,
            border: "1px solid #334155",
            backgroundColor: "#111827",
            padding: 36,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                borderRadius: 9999,
                border: "1px solid #334155",
                backgroundColor: "#1E293B",
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
                fontSize: 58,
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
                fontSize: 27,
                lineHeight: 1.35,
                color: "#CBD5E1",
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
                    border: "1px solid #334155",
                    backgroundColor: "#1E293B",
                    padding: "9px 14px",
                    fontSize: 20,
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
              width: 292,
              height: 360,
              borderRadius: 22,
              border: "1px solid #94A3B8",
              backgroundColor: "#F8FAFC",
              padding: 18,
              display: "flex",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 16,
                backgroundColor: "#E2E8F0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#1E3A8A",
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
