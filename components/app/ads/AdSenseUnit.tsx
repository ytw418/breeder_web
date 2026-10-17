"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  getAdSenseClient,
  getAdSenseSlot,
  type AdSensePlacement,
} from "@libs/client/adsConfig";
import { cn } from "@libs/client/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { loaded?: boolean };
  }
}

/**
 * AdSense 스크립트는 광고 칸이 처음 그려질 때 한 번만 넣는다. 이 태그는 자동 광고 태그이기도 해서
 * 모든 화면에 넣으면 분양·경매 화면에도 자동 광고가 붙을 수 있다(자동 광고는 콘솔에서도 끈다).
 */
function loadAdSenseScript(client: string) {
  if (document.getElementById("adsbygoogle-js")) return;
  const script = document.createElement("script");
  script.id = "adsbygoogle-js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.appendChild(script);
}

/** 이 시간 안에 채워졌다는 표시가 없으면(차단기·승인 전 사이트) 자리를 접는다. */
const FILL_TIMEOUT_MS = 8_000;

/**
 * AdSense 광고 한 칸. 스크립트는 첫 칸이 그려질 때 한 번만 불러온다.
 * rectangle 은 300×250 고정, horizontal 은 화면 폭 반응형이다. 크기를 미리 잡아 두고,
 * 광고가 없으면(data-ad-status="unfilled"·시간 초과) '광고' 라벨까지 통째로 접는다.
 * "unfill-optimized"(AdSense 가 추천 검색어 등으로 칸을 채움)는 채워진 것으로 본다.
 */
export default function AdSenseUnit({
  placement,
  format,
  withGap = false,
  className,
}: {
  placement: AdSensePlacement;
  format: "rectangle" | "horizontal";
  /** 위에 8px 섹션 구분선을 둔다(접히면 구분선도 같이 없어진다). */
  withGap?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const client = getAdSenseClient();
  const slot = getAdSenseSlot(placement);
  if (!client || !slot) return null;
  // 상세에서 다른 상세로 옮기면 같은 칸을 새 페이지 광고로 다시 채운다.
  return (
    <AdSenseIns
      key={pathname}
      client={client}
      slot={slot}
      format={format}
      withGap={withGap}
      className={className}
    />
  );
}

function AdSenseIns({
  client,
  slot,
  format,
  withGap,
  className,
}: {
  client: string;
  slot: string;
  format: "rectangle" | "horizontal";
  withGap: boolean;
  className?: string;
}) {
  const insRef = useRef<HTMLModElement>(null);
  const [status, setStatus] = useState<"loading" | "filled" | "unfilled">(
    "loading",
  );

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;
    loadAdSenseScript(client);
    const read = () => {
      const value = ins.getAttribute("data-ad-status");
      if (value === "filled" || value === "unfill-optimized") setStatus("filled");
      else if (value === "unfilled") setStatus("unfilled");
    };
    const observer = new MutationObserver(read);
    observer.observe(ins, {
      attributes: true,
      attributeFilter: ["data-ad-status"],
    });
    // 같은 칸에 두 번 넣으면 AdSense 가 오류를 낸다. 스크립트가 돈 뒤에는 status 속성으로 막히고,
    // 스크립트가 돌기 전 대기열에 넣은 몫은 접히거나 정리될 때 뺀다(Strict Mode effect 두 번 실행·접힌 칸).
    let queued: object | null = null;
    const dequeue = () => {
      const queue = window.adsbygoogle;
      if (!queued || !queue || queue.loaded) return;
      const index = queue.indexOf(queued);
      if (index >= 0) queue.splice(index, 1);
      queued = null;
    };
    if (!ins.getAttribute("data-adsbygoogle-status")) {
      try {
        queued = {};
        (window.adsbygoogle = window.adsbygoogle || []).push(queued);
      } catch {
        setStatus("unfilled");
      }
    }
    const timer = window.setTimeout(() => {
      dequeue();
      setStatus((current) => (current === "loading" ? "unfilled" : current));
    }, FILL_TIMEOUT_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      dequeue();
    };
  }, [client]);

  if (status === "unfilled") return null;

  return (
    <>
      {withGap ? <div className="h-2 bg-app-gap" /> : null}
      <div className={cn("flex flex-col items-center gap-1.5", className)}>
        {status === "filled" ? (
          <span className="self-start text-[11px] text-app-muted">광고</span>
        ) : null}
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={
            format === "rectangle"
              ? { display: "inline-block", width: 300, height: 250 }
              : { display: "block", width: "100%", minHeight: 100 }
          }
          data-ad-client={client}
          data-ad-slot={slot}
          {...(format === "horizontal"
            ? {
                "data-ad-format": "horizontal",
                "data-full-width-responsive": "true",
              }
            : {})}
          // 운영 빌드가 아니면 테스트 요청으로 보내 내 광고 노출·클릭이 집계되지 않게 한다.
          {...(process.env.NODE_ENV === "production"
            ? {}
            : { "data-adtest": "on" })}
        />
      </div>
    </>
  );
}
