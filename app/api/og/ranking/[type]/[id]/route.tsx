import { ImageResponse } from "next/og";
import client from "@libs/server/client";

export const runtime = "nodejs";

const loadPayload = async (type: string, id: number) => {
  if (type === "breeder") {
    const user = await client.user.findUnique({
      where: { id },
      select: { name: true },
    });
    return {
      eyebrow: "Weekly Top Breeder",
      title: user?.name || "브리더",
      subtitle: "실력은 기록되고, 신뢰는 거래로 증명됩니다.",
    };
  }

  if (type === "auction") {
    const auction = await client.auction.findUnique({
      where: { id },
      select: { title: true, currentPrice: true },
    });
    return {
      eyebrow: "Highest Auction",
      title: auction?.title || "최고가 경매",
      subtitle: auction ? `${auction.currentPrice.toLocaleString()}원` : "브리디 경매 랭킹",
    };
  }

  const bloodline = await client.bloodlineCard.findUnique({
    where: { id },
    select: { name: true, speciesType: true },
  });
  return {
    eyebrow: "Popular Bloodline",
    title: bloodline?.name || "인기 혈통",
    subtitle: bloodline?.speciesType || "브리디 혈통 랭킹",
  };
};

export async function GET(
  _: Request,
  { params }: { params: { type: string; id: string } }
) {
  const id = Number(params.id);
  const payload = await loadPayload(params.type, id);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
          color: "white",
          padding: "56px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.75,
          }}
        >
          {payload.eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>
            {payload.title}
          </div>
          <div style={{ fontSize: 32, opacity: 0.86 }}>{payload.subtitle}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.8 }}>bredy.app</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
