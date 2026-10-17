"use client";

import { useEffect, useId, useRef, useState } from "react";

import { getCoupangWebConfig } from "@libs/client/adsConfig";
import { cn } from "@libs/client/utils";

declare global {
  interface Window {
    PartnersCoupang?: { G: new (options: Record<string, unknown>) => unknown };
  }
}

/** 공정위 추천·보증 심사지침의 경제적 이해관계 표시. 앱 CoupangDynamicBanner 와 같은 문구다. */
export const COUPANG_DISCLOSURE =
  "이 광고는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

/** 파트너스에서 만든 배너 크기(px). 화면이 좁으면 폭에 맞춰 같은 비율로 줄인다. */
const BANNER_WIDTH = 680;
const BANNER_HEIGHT = 140;
/** 이 시간 안에 광고 유무 응답이 없으면 자리를 접는다. */
const LOAD_TIMEOUT_MS = 8_000;
/** env 는 빌드 때 고정되므로 한 번만 읽는다(렌더마다 새 객체면 effect 가 위젯을 다시 만든다). */
const CONFIG = getCoupangWebConfig();

let scriptPromise: Promise<void> | null = null;
/**
 * 같은 배너 ID 위젯이 한꺼번에 뜨면 g.js 가 한 위젯의 응답(onLoaded)을 다른 위젯에도 알린다.
 * 그래서 위젯은 한 번에 하나씩, 앞 위젯의 응답이 오거나 시간이 지난 뒤에 만든다.
 */
let widgetTurn: Promise<void> = Promise.resolve();

/** g.js 는 페이지에 한 번만 넣는다. 실패하면 다음 배너가 다시 시도한다. */
function loadCoupangScript(): Promise<void> {
  if (window.PartnersCoupang) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://ads-partners.coupang.com/g.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("coupang g.js load failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * 쿠팡 파트너스 다이나믹 배너 + 대가성 고지(앱 docs/prd/ads.md §10).
 * 화면 가까이 오면 그때 위젯을 만든다. 광고가 없거나(hasAd=false) 오류·응답 없음이면 고지까지 통째로 접는다.
 * section 은 상세 화면 맨 아래 블록(위 8px 구분선), row 는 목록 사이 행이다.
 */
export default function CoupangBanner({
  variant = "section",
  className,
}: {
  variant?: "section" | "row";
  className?: string;
}) {
  const config = CONFIG;
  const containerId = `coupang-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const boxRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"waiting" | "loading" | "shown" | "hidden">("waiting");
  const [size, setSize] = useState({ width: BANNER_WIDTH, height: BANNER_HEIGHT });

  useEffect(() => {
    const box = boxRef.current;
    if (!config || !box) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const width = Math.min(BANNER_WIDTH, Math.floor(box.clientWidth));
        setSize({ width, height: Math.round((width * BANNER_HEIGHT) / BANNER_WIDTH) });
        setPhase("loading");
      },
      { rootMargin: "200px" },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [config]);

  useEffect(() => {
    if (!config || phase !== "loading") return;
    let alive = true;
    let timer = 0;
    let finish: (next: "shown" | "hidden") => void = () => {};
    const turn = widgetTurn.then(
      () =>
        new Promise<void>((release) => {
          let settled = false;
          finish = (next) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            release();
            if (alive) setPhase(next);
          };
          if (!alive) return finish("hidden");
          timer = window.setTimeout(() => finish("hidden"), LOAD_TIMEOUT_MS);
          loadCoupangScript()
            .then(() => {
              if (!alive || !window.PartnersCoupang) return finish("hidden");
              new window.PartnersCoupang.G({
                id: config.bannerId,
                template: "carousel",
                trackingCode: config.trackingCode,
                width: String(size.width),
                height: String(size.height),
                tsource: "",
                isApp: false,
                container: `#${containerId}`,
                onLoaded: (hasAd: boolean) => finish(hasAd ? "shown" : "hidden"),
              });
            })
            .catch(() => finish("hidden"));
        }),
    );
    widgetTurn = turn.catch(() => {});
    return () => {
      alive = false;
      // 기다리던 차례·응답을 끝내 다음 위젯이 막히지 않게 한다.
      finish("hidden");
    };
  }, [config, phase, size, containerId]);

  if (!config || phase === "hidden") return null;

  return (
    <div className={className}>
      {variant === "section" ? <div className="h-2 bg-app-gap" /> : null}
      <div className={cn("px-4", variant === "section" ? "py-4" : "border-b border-app-line py-3")}>
        <div
          ref={boxRef}
          // 광고가 확인되기 전에는 배너 비율만큼 비워 두어 뜰 때 화면이 밀리지 않게 한다.
          style={
            phase === "shown"
              ? undefined
              : { width: "100%", maxWidth: BANNER_WIDTH, aspectRatio: `${BANNER_WIDTH} / ${BANNER_HEIGHT}` }
          }
          className="mx-auto flex justify-center overflow-hidden rounded-lg"
        >
          <div id={containerId} className="leading-none" />
        </div>
        {phase === "shown" ? (
          <p className="mt-2 text-[12px] leading-4 text-app-muted">{COUPANG_DISCLOSURE}</p>
        ) : null}
      </div>
    </div>
  );
}
