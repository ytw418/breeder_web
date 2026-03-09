"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";

const SHARE_LABELS: Record<string, string> = {
  breeder: "주간 TOP 브리더",
  auction: "최고가 경매",
  bloodline: "인기 혈통",
};

const ShareRankingPage = () => {
  const params = useParams();
  const type = String(params?.type || "");
  const id = String(params?.id || "");
  const title = SHARE_LABELS[type] || "랭킹 카드";
  const ogUrl = useMemo(() => `/api/og/ranking/${type}/${id}`, [id, type]);

  const shareUrl =
    typeof window === "undefined" ? ogUrl : new URL(`/share/ranking/${type}/${id}`, window.location.origin).toString();

  const handleShare = async () => {
    trackEvent(ANALYTICS_EVENTS.shareCardExport, {
      card_type: type,
      channel: typeof navigator.share === "function" ? "native_share" : "copy_link",
      entity_id: Number(id),
    });

    if (typeof navigator.share === "function") {
      await navigator.share({
        title,
        text: `${title} 카드를 공유합니다.`,
        url: shareUrl,
      });
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
  };

  return (
    <Layout canGoBack title="공유 카드" seoTitle="공유 카드">
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="app-kicker">{title}</p>
          <Image
            src={ogUrl}
            alt={title}
            width={1200}
            height={630}
            className="mt-3 w-full rounded-2xl border border-slate-200"
          />
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white"
            >
              공유하기
            </button>
            <a
              href={ogUrl}
              download={`${type}-${id}.png`}
              onClick={() =>
                trackEvent(ANALYTICS_EVENTS.shareCardExport, {
                  card_type: type,
                  channel: "download",
                  entity_id: Number(id),
                })
              }
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              이미지 저장
            </a>
            <Link
              href="/ranking"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700"
            >
              랭킹으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ShareRankingPage;
