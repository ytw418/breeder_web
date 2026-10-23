"use client";
/**
 * 앱 소개·다운로드 랜딩(/download). 공유용 한 장짜리 페이지 — 설치 버튼, 웹으로 바로 가기, 화면 소개.
 * 2026-10-23 "바로 설치하고 싶게, 버튼을 이쁘게": 공식 배지 대신 기기 스토어로 가는 큰 주황 버튼(모르면 두 스토어 버튼), 화면 콜라주, 스크롤하면 아래 설치 바.
 * 아이폰이면 App Store, 안드로이드면 Google Play 를 주 버튼으로 둔다.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { shareOrCopy } from "@libs/client/share";
import { APP_STORE_URL, DOWNLOAD_PAGE_PATH, PLAY_STORE_URL } from "@libs/shared/appLinks";
import { GUIDE_INDEX_HREF } from "@libs/shared/guides";

/** 스토어 스크린샷과 같은 디자인 세트(bredy_app store-assets/screenshots/ios, 2026-10-20). 문구가 이미지 안에 있어 alt 로 같은 문구를 둔다. */
const SCREENS = [
  { src: "/landing/store-v3-01-home.jpg", alt: "강아지·고양이부터 곤충·파충류까지, 키우는 사람들이 모이는 커뮤니티" },
  { src: "/landing/store-v3-02-categories.jpg", alt: "관심 있는 동물만 골라 보세요" },
  { src: "/landing/store-v3-03-products.jpg", alt: "보고 싶은 종만 골라서 분양 보기" },
  { src: "/landing/store-v3-04-product-detail.jpg", alt: "분양글 올리기는 무료예요" },
  { src: "/landing/store-v3-05-auction-detail.jpg", alt: "경매로 투명하게 분양해요" },
  { src: "/landing/store-v3-06-guide.jpg", alt: "처음 키운다면 사육 가이드부터" },
];

/** heroicons outline 1.5px */
const FEATURES = [
  {
    title: "사진으로 기록해요",
    desc: "키우는 아이 사진을 앨범으로 모아요.",
    icon: "M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316ZM16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z",
  },
  {
    title: "같은 종 키우는 사람에게 물어봐요",
    desc: "질문하면 같은 종을 키우는 사람들이 답해요. 찬반 토론도 열 수 있어요.",
    icon: "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z",
  },
  {
    title: "분양글은 무료로 올려요",
    desc: "곤충·파충류·물고기 분양을 올리고, 우리 동네 브리더도 찾아요.",
    icon: "M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
  },
  {
    title: "경매로 분양해요",
    desc: "입찰부터 마감까지 한 화면에서 보고, 링크 하나로 공유해요.",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  {
    title: "혈통을 카드로 남겨요",
    desc: "개체의 혈통을 카드로 만들고, 분양할 때 다음 주인에게 이어 줘요.",
    icon: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z",
  },
];

/** 기능 아이콘 칸 색. 앱 아바타 대체 색 토큰을 돌려 쓴다(다크에서도 맞는 짝). */
const FEATURE_TONES = [
  "bg-app-brand-soft text-app-brand-text",
  "bg-app-avatar-1-bg text-app-avatar-1-fg",
  "bg-app-avatar-2-bg text-app-avatar-2-fg",
  "bg-app-avatar-3-bg text-app-avatar-3-fg",
  "bg-app-avatar-4-bg text-app-avatar-4-fg",
];

/** simple-icons 로고(24 격자, 채움) */
const APPLE_LOGO =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";
const PLAY_LOGO =
  "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z";
const SHARE_ICON =
  "M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z";

type Platform = "ios" | "android" | "other";

const STORES = {
  ios: { href: APP_STORE_URL, logo: APPLE_LOGO, name: "App Store", label: "App Store에서 브리디 다운로드" },
  android: { href: PLAY_STORE_URL, logo: PLAY_LOGO, name: "Google Play", label: "Google Play에서 브리디 다운로드" },
} as const;

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Logo({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** 이 기기 스토어로 바로 가는 큰 주황 버튼. */
function PrimaryStoreButton({ store, className = "" }: { store: keyof typeof STORES; className?: string }) {
  const s = STORES[store];
  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={s.label}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-app-brand text-white shadow-[0_8px_20px_-6px_rgba(249,115,22,0.55)] transition-transform active:scale-[0.98] ${className}`}
    >
      <Logo d={s.logo} size={22} />
      <span className="text-[17px] font-bold tracking-[-0.3px]">무료로 앱 받기</span>
    </a>
  );
}

/** 스토어 두 개를 나란히 — 검정(다크는 흰) 채움, 로고 + 두 줄 글자. */
function StoreButtons({ order }: { order: (keyof typeof STORES)[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {order.map((key) => {
        const s = STORES[key];
        return (
          <a
            key={key}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-app-inverse px-3 text-app-inverse-text transition-transform active:scale-[0.98]"
          >
            <Logo d={s.logo} size={key === "ios" ? 24 : 21} />
            <span className="flex flex-col items-start leading-none">
              <span className="text-[11px] font-medium opacity-80">무료 다운로드</span>
              <span className="mt-1 text-[16px] font-bold tracking-[-0.3px]">{s.name}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

/** 기기를 알면 큰 버튼 하나 + 다른 스토어 글자 링크, 모르면(PC) 두 버튼을 같은 무게로. */
function InstallCta({ platform }: { platform: Platform }) {
  if (platform === "other") return <StoreButtons order={["ios", "android"]} />;
  const other = STORES[platform === "ios" ? "android" : "ios"];
  return (
    <>
      <PrimaryStoreButton store={platform} />
      <a href={other.href} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-[13px] text-app-muted">
        {platform === "ios" ? "안드로이드폰이라면" : "아이폰이라면"} <span className="font-semibold text-app-sub underline underline-offset-2">{other.name}에서 받기</span>
      </a>
    </>
  );
}

export default function DownloadLanding() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [showBar, setShowBar] = useState(false);
  const heroCtaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "other");
  }, []);

  // 첫 화면 버튼이 화면 밖으로 나가면 아래 고정 설치 바를 띄운다(모바일만 — PC 는 스캔할 수단이 없어 두 버튼만 둔다).
  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || platform === "other") return;
    const io = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [platform]);

  const share = () =>
    void shareOrCopy({
      title: "브리디 — 강아지·고양이부터 곤충·파충류까지 키우는 사람들이 모이는 곳",
      text: "사진 기록·질문·분양·경매·혈통카드까지, 브리디 앱 받아 보세요",
      url: DOWNLOAD_PAGE_PATH,
    });

  return (
    <div className="break-keep bg-app-bg pb-10 text-app-text">
      {/* 첫 화면: 주황 빛 바탕 + 문구 + 설치 버튼 + 화면 콜라주 */}
      <div className="overflow-hidden bg-gradient-to-b from-app-brand-surface via-app-brand-surface to-app-bg">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="브리디 홈">
            <Image src="/landing/app-icon.png" alt="" width={28} height={28} className="rounded-lg" />
            <span className="text-[18px] font-bold">브리디</span>
          </Link>
          <Link href="/" className="text-[14px] font-semibold text-app-sub">
            웹으로 보기 ›
          </Link>
        </div>

        <section className="px-5 pt-5 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-bg px-3 py-1 text-[12px] font-semibold text-app-brand-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <span className="h-1.5 w-1.5 rounded-full bg-app-brand" />
            아이폰 · 안드로이드 무료
          </span>
          <h1 className="mt-4 text-[28px] font-extrabold leading-[38px] tracking-[-0.8px]">
            강아지·고양이부터
            <br />
            곤충·파충류·물고기까지
            <br />
            <span className="text-app-brand">키우는 사람들이 모이는 곳</span>
          </h1>
          <p className="mt-3 text-[15px] leading-[23px] text-app-sub">
            사진 기록, 같은 종 키우는 사람에게 질문,
            <br />
            분양·경매까지 한 앱에서 해요.
          </p>
          <div ref={heroCtaRef} className="mx-auto mt-6 max-w-[360px]">
            <InstallCta platform={platform} />
          </div>
        </section>

        {/* 화면 콜라주: 가운데 홈, 양옆으로 분양·경매가 비스듬히 */}
        <div aria-hidden="true" className="relative mx-auto mt-9 h-[330px] max-w-[400px]">
          <Image
            src={SCREENS[2].src}
            alt=""
            width={600}
            height={1303}
            sizes="150px"
            className="absolute left-1/2 top-10 w-[150px] -translate-x-[150%] -rotate-[8deg] rounded-[22px] border border-app-line shadow-[0_12px_30px_-10px_rgba(0,0,0,0.25)]"
          />
          <Image
            src={SCREENS[4].src}
            alt=""
            width={600}
            height={1303}
            sizes="150px"
            className="absolute left-1/2 top-10 w-[150px] translate-x-[50%] rotate-[8deg] rounded-[22px] border border-app-line shadow-[0_12px_30px_-10px_rgba(0,0,0,0.25)]"
          />
          <Image
            src={SCREENS[0].src}
            alt=""
            width={600}
            height={1303}
            sizes="180px"
            priority
            className="absolute left-1/2 top-0 w-[180px] -translate-x-1/2 rounded-[26px] border border-app-line shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-app-bg to-transparent" />
        </div>
      </div>

      {/* 화면 소개 */}
      <section aria-label="앱 화면" className="pt-2">
        <h2 className="px-5 text-[20px] font-bold leading-7 tracking-[-0.5px]">이런 화면이에요</h2>
        <HorizontalRail label="앱 화면" className="mt-4 snap-x snap-mandatory scroll-px-5 gap-3 px-5">
          {SCREENS.map((s) => (
            <span key={s.src} className="block w-[200px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-app-line">
              <Image src={s.src} alt={s.alt} width={600} height={1303} sizes="200px" className="h-auto w-full" />
            </span>
          ))}
        </HorizontalRail>
      </section>

      {/* 할 수 있는 것 */}
      <section className="px-5 pt-10">
        <h2 className="text-[20px] font-bold leading-7 tracking-[-0.5px]">브리디에서 할 수 있는 것</h2>
        <ul className="mt-4 grid gap-2.5">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="flex gap-3.5 rounded-2xl bg-app-surface p-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${FEATURE_TONES[i % FEATURE_TONES.length]}`}>
                <Icon d={f.icon} />
              </span>
              <span>
                <b className="block text-[16px] font-bold leading-6">{f.title}</b>
                <span className="mt-0.5 block text-[14px] leading-[21px] text-app-muted">{f.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link
          href={GUIDE_INDEX_HREF}
          className="mt-2.5 flex items-center justify-between rounded-2xl border border-app-line px-4 py-4 text-[15px] font-semibold"
        >
          처음 키운다면, 종별 사육 가이드
          <span className="text-[13px] font-normal text-app-muted">보러 가기 ›</span>
        </Link>
      </section>

      {/* 마무리: 검정 카드 */}
      <section className="px-5 pt-10">
        <div className="rounded-3xl bg-app-inverse px-5 pb-6 pt-8 text-center text-app-inverse-text">
          <Image src="/landing/app-icon.png" alt="" width={56} height={56} className="mx-auto rounded-2xl" />
          <h2 className="mt-4 text-[22px] font-extrabold leading-[30px] tracking-[-0.5px]">
            우리 아이 이야기,
            <br />
            브리디에서 시작해요
          </h2>
          <p className="mt-2 text-[14px] opacity-70">가입·분양글 올리기 모두 무료예요</p>
          <div className="mt-6">
            {platform === "other" ? (
              <div className="grid grid-cols-2 gap-2.5">
                {(["ios", "android"] as const).map((key) => (
                  <a
                    key={key}
                    href={STORES[key].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={STORES[key].label}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-app-bg text-[15px] font-bold text-app-text"
                  >
                    <Logo d={STORES[key].logo} size={20} />
                    {STORES[key].name}
                  </a>
                ))}
              </div>
            ) : (
              <PrimaryStoreButton store={platform} />
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={share}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-app-surface text-[14px] font-semibold text-app-text"
          >
            <Icon d={SHARE_ICON} size={18} />
            친구에게 공유
          </button>
          <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-app-surface text-[14px] font-semibold text-app-text">
            웹에서 먼저 보기
          </Link>
        </div>
        <p className="mt-6 text-center text-[13px] text-app-muted">
          문의는 <Link href="/support" className="underline underline-offset-2">고객센터</Link>로 남겨 주세요
        </p>
      </section>

      {/* 아래 고정 설치 바 — 첫 화면 버튼이 지나간 뒤에만 */}
      {platform !== "other" && (
        <div
          className={`fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-app-line bg-app-bg px-4 pb-[max(calc(env(safe-area-inset-bottom)+10px),14px)] pt-2.5 transition-transform duration-300 ${showBar ? "translate-y-0" : "translate-y-full"}`}
          aria-hidden={!showBar}
        >
          <div className="flex items-center gap-3">
            <Image src="/landing/app-icon.png" alt="" width={40} height={40} className="rounded-xl" />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-bold leading-5">브리디</b>
              <span className="block truncate text-[12px] text-app-muted">키우는 사람들의 커뮤니티 · 무료</span>
            </span>
            <a
              href={STORES[platform].href}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={showBar ? 0 : -1}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-app-brand px-4 text-[14px] font-bold text-white"
            >
              <Logo d={STORES[platform].logo} size={16} />
              받기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
