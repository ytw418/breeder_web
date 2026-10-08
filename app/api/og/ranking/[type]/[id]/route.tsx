import { ImageResponse } from "next/og";
import client from "@libs/server/client";
import { displayUserName } from "@libs/shared/deletedUser";

export const runtime = "nodejs";

const loadPayload = async (type: string, id: number) => {
  if (type === "breeder") {
    const user = await client.user.findUnique({
      where: { id },
      select: { name: true },
    });
    return {
      eyebrow: "주간 TOP 브리더",
      // 탈퇴한 브리더는 "탈퇴한 사용자#<id>" 대신 표시용 라벨로 그린다.
      title: displayUserName(user?.name) || "브리더",
      subtitle: "실력은 기록되고, 신뢰는 거래로 증명됩니다.",
    };
  }

  if (type === "auction") {
    const auction = await client.auction.findUnique({
      where: { id },
      select: { title: true, currentPrice: true },
    });
    return {
      eyebrow: "최고가 경매",
      title: auction?.title || "최고가 경매",
      subtitle: auction ? `${auction.currentPrice.toLocaleString()}원` : "브리디 경매 랭킹",
    };
  }

  const bloodline = await client.bloodlineCard.findUnique({
    where: { id },
    select: { name: true, speciesType: true },
  });
  return {
    eyebrow: "인기 혈통",
    title: bloodline?.name || "인기 혈통",
    subtitle: bloodline?.speciesType || "브리디 혈통 랭킹",
  };
};

export async function GET(
  _: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id: rawId } = await params;
  const id = Number(rawId);
  const payload = await loadPayload(type, id);

  // 플랫 카드(design/mockups/REFERENCE.md): 그라데이션 없이 흰 바탕 + 검정 제목 + 회색 보조.
  // 공유 이미지는 외부에서 보이므로 테마와 무관한 라이트 색으로 고정한다.
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          color: "#212124",
          padding: "56px",
        }}
      >
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: "#4D5159",
              background: "#F2F3F6",
              borderRadius: 12,
              padding: "10px 20px",
            }}
          >
            {payload.eyebrow}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, color: "#191919" }}>
            {payload.title}
          </div>
          <div style={{ fontSize: 32, color: "#6E737C" }}>{payload.subtitle}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#4D5159" }}>
          브리디 · bredy.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
