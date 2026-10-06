"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { shareOrCopy } from "@libs/client/share";

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

  const handleShare = async () => {
    trackEvent(ANALYTICS_EVENTS.shareCardExport, {
      card_type: type,
      channel: typeof navigator.share === "function" ? "native_share" : "copy_link",
      entity_id: Number(id),
    });

    await shareOrCopy({
      title,
      text: `${title} 카드를 공유합니다.`,
      url: `/share/ranking/${type}/${id}`,
    });
  };

  return (
    <Layout canGoBack title="공유 카드" seoTitle="공유 카드">
      <div className="min-h-full bg-app-bg px-4 pb-10 pt-4">
        <div className="mx-auto max-w-md">
          <h1 className="text-[18px] font-bold text-app-text">{title}</h1>
          <Image
            src={ogUrl}
            alt={title}
            width={1200}
            height={630}
            // OG 라우트가 이미 PNG 를 만든다. 최적화 캐시를 거치면 카드가 바뀌어도 옛 이미지가 남는다.
            unoptimized
            className="mt-3 w-full rounded-xl border border-app-border"
          />
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-[52px] items-center justify-center rounded-md bg-app-brand text-[16px] font-semibold text-white"
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
              className="inline-flex h-[52px] items-center justify-center rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
            >
              이미지 저장
            </a>
            <Link
              href="/ranking"
              className="inline-flex h-11 items-center justify-center text-[14px] text-app-muted"
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
