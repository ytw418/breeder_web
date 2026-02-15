import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import client from "@libs/server/client";

interface PageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const numericId = Number(params.id);
  if (!Number.isFinite(numericId)) {
    return { title: "혈통카드 상세 | 브리디" };
  }

  const card = await client.bloodlineCard.findUnique({
    where: { id: numericId },
    select: { name: true, description: true },
  });

  return {
    title: card ? `${card.name} | 혈통카드` : "혈통카드 상세 | 브리디",
    description: card?.description || "브리디 혈통카드 상세 페이지",
  };
}

export default async function BloodlineCardDetailPage({ params }: PageProps) {
  const numericId = Number(params.id);
  if (!Number.isFinite(numericId)) notFound();

  const card = await client.bloodlineCard.findUnique({
    where: { id: numericId },
    include: {
      creator: { select: { name: true } },
      currentOwner: { select: { name: true } },
      transfers: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
        },
      },
    },
  });

  if (!card) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[720px] space-y-4 px-4 py-6">
      <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-[#120b02] via-[#2a1a05] to-[#674008] p-5 text-amber-50 shadow-[0_20px_60px_rgba(71,42,5,0.45)]">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-100/80">BREDY BLOODLINE CARD</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">{card.name}</h1>
        <p className="mt-3 text-sm leading-relaxed text-amber-100/90">
          {card.description || "등록된 카드 소개가 없습니다."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <p className="rounded-lg bg-black/20 px-3 py-2">카드번호: BC-{String(card.id).padStart(6, "0")}</p>
          <p className="rounded-lg bg-black/20 px-3 py-2">보유자: {card.currentOwner.name}</p>
          <p className="rounded-lg bg-black/20 px-3 py-2">제작자: {card.creator.name}</p>
          <p className="rounded-lg bg-black/20 px-3 py-2">전달 횟수: {card.transfers.length}회</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">최근 전달 이력</p>
        <div className="mt-2 space-y-1.5">
          {card.transfers.length ? (
            card.transfers.map((transfer) => (
              <p key={transfer.id} className="text-xs text-slate-600">
                {new Date(transfer.createdAt).toLocaleDateString("ko-KR")} · {transfer.fromUser?.name || "시스템"} → {transfer.toUser.name}
                {transfer.note ? ` · ${transfer.note}` : ""}
              </p>
            ))
          ) : (
            <p className="text-xs text-slate-500">아직 전달 이력이 없습니다.</p>
          )}
        </div>
      </section>

      <Link href="/bloodline-cards/owned" className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
        보유 혈통 리스트로 이동
      </Link>
    </main>
  );
}
