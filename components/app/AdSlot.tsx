"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 웹 상세 하단 AdSense 광고 한 칸(300×250 고정). 크기를 미리 잡아 광고가 늦게 떠도 화면이 밀리지 않는다.
 * NEXT_PUBLIC_ADSENSE_CLIENT·NEXT_PUBLIC_ADSENSE_SLOT_DETAIL 이 둘 다 있을 때만 ExploreMore 가 그린다.
 */
export default function AdSlot({ client, slot }: { client: string; slot: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 실패하면 빈 자리만 남는다.
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-5">
      <span className="self-start text-[11px] text-app-muted">광고</span>
      <ins
        className="adsbygoogle block bg-app-surface"
        style={{ display: "inline-block", width: 300, height: 250 }}
        data-ad-client={client}
        data-ad-slot={slot}
      />
      <Script
        id="adsbygoogle-js"
        async
        strategy="lazyOnload"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        crossOrigin="anonymous"
      />
    </div>
  );
}
