import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function ToolOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(140deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          fontFamily: "Inter, Pretendard, sans-serif",
          padding: "64px 68px",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "rgba(56, 189, 248, 0.18)",
            filter: "blur(36px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -100,
            bottom: -120,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background: "rgba(148, 163, 184, 0.2)",
            filter: "blur(32px)",
          }}
        />

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              borderRadius: 9999,
              border: "1px solid rgba(248,250,252,0.25)",
              background: "rgba(248,250,252,0.1)",
              padding: "8px 16px",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            Auction Form
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 76,
              lineHeight: 1.05,
              letterSpacing: -1.2,
              fontWeight: 900,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>단순 경매</span>
            <span>폼 생성기</span>
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 30,
              lineHeight: 1.35,
              color: "#cbd5e1",
            }}
          >
            빠르게 등록하고 링크로 공유하는
            <br />
            심플한 경매 생성 화면
          </div>
        </div>
      </div>
    ),
    size
  );
}
