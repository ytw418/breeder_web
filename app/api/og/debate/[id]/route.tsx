import { ImageResponse } from "next/og";
import client from "@libs/server/client";
import {
  evergreenFieldLabel,
  RESULT_CARD_MIN_VOTES,
  resultCardLead,
  resultCardPeriod,
} from "@libs/shared/debateFormat";

export const runtime = "nodejs";

/**
 * 상시 토론 결과 카드 이미지(앱 docs/prd/evergreen-debate.md S-5).
 * GET /api/og/debate/:id?size=card(1080×1350, 인스타·저장) | og(1200×630, 링크 미리보기)
 * 상시 토론이고 활성 회원 표가 30표 이상일 때만 그린다. 아니면 404. 닉네임은 넣지 않는다.
 * 외부에서 보이는 그림이라 테마와 무관한 라이트 색으로 고정한다.
 */
async function loadCard(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const debate = await client.debate.findUnique({
    where: { postId: id },
    select: {
      optionA: true,
      optionB: true,
      endsAt: true,
      evergreenField: true,
      post: { select: { title: true, isHidden: true } },
    },
  });
  if (!debate || debate.endsAt !== null || debate.post.isHidden) return null;
  const active = { postId: id, user: { status: "ACTIVE" as const } };
  const [countA, countB, first] = await Promise.all([
    client.debateVote.count({ where: { ...active, side: "A" } }),
    client.debateVote.count({ where: { ...active, side: "B" } }),
    client.debateVote.findFirst({ where: active, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  if (countA + countB < RESULT_CARD_MIN_VOTES || !first) return null;
  return {
    title: debate.post.title,
    field: evergreenFieldLabel(debate.evergreenField),
    lead: resultCardLead(debate, countA, countB),
    total: countA + countB,
    period: resultCardPeriod(first.createdAt),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await loadCard(Number(id));
  if (!card) return new Response("Not found", { status: 404 });
  const og = new URL(request.url).searchParams.get("size") === "og";
  const scale = og ? 0.9 : 1;
  const big = card.lead.tie ? "50:50" : `${card.lead.percent}%`;
  const caption = card.lead.tie ? "팽팽해요" : `"${card.lead.label}"`;

  const image = new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FFF8F2",
          color: "#212124",
          padding: og ? "56px 64px" : "88px 80px",
        }}
      >
        <div style={{ display: "flex", fontSize: 34 * scale, fontWeight: 700, color: "#C2410C" }}>
          {`브리디 상시 토론 · ${card.field}`}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28 * scale,
            fontSize: (og ? 56 : 76) * scale,
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: -2,
          }}
        >
          {card.title}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            fontSize: (og ? 150 : 220) * scale,
            fontWeight: 800,
            lineHeight: 1,
            color: "#F97316",
            letterSpacing: -6,
          }}
        >
          {big}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 52 * scale, fontWeight: 700 }}>{caption}</div>
        <div style={{ display: "flex", marginTop: 36 * scale, height: 28 * scale, gap: 8 }}>
          <div style={{ display: "flex", width: `${card.lead.percents.a}%`, background: "#F97316", borderRadius: 14 }} />
          <div style={{ display: "flex", width: `${card.lead.percents.b}%`, background: "#212124", borderRadius: 14 }} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 36 * scale,
            fontSize: 34 * scale,
            color: "#6E737C",
          }}
        >
          <div style={{ display: "flex" }}>{`${card.period} · ${card.total.toLocaleString("ko-KR")}명 참여`}</div>
          <div style={{ display: "flex", fontWeight: 700, color: "#212124" }}>bredy.app</div>
        </div>
      </div>
    ),
    og ? { width: 1200, height: 630 } : { width: 1080, height: 1350 }
  );
  image.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return image;
}
