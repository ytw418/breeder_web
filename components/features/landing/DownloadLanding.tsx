"use client";
/**
 * 앱 소개·다운로드 랜딩(/download). 공유용 한 장짜리 페이지 — 앱스토어·플레이스토어 배지, 웹으로 바로 가기, 화면 소개.
 * 배지는 애플·구글 공식 이미지(public/landing)를 쓴다(두 회사 모두 다운로드 버튼에 공식 배지를 쓰라고 정해 두었다).
 * 안드로이드 브라우저면 플레이 배지를, 그 밖에는 앱스토어 배지를 앞에 둔다.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function StoreBadges({ playFirst }: { playFirst: boolean }) {
  const apple = (
    <a key="apple" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="App Store에서 브리디 다운로드" className="shrink-0">
      <Image src="/landing/app-store-badge.svg" alt="App Store에서 다운로드" width={144} height={48} className="h-12 w-auto" unoptimized />
    </a>
  );
  const play = (
    <a key="play" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Google Play에서 브리디 다운로드" className="shrink-0">
      <Image src="/landing/google-play-badge.png" alt="Google Play에서 받기" width={161} height={48} className="h-12 w-auto" />
    </a>
  );
  return <div className="flex flex-wrap items-center gap-3">{playFirst ? [play, apple] : [apple, play]}</div>;
}

export default function DownloadLanding() {
  const [playFirst, setPlayFirst] = useState(false);
  useEffect(() => {
    setPlayFirst(/android/i.test(navigator.userAgent));
  }, []);

  const share = () =>
    void shareOrCopy({
      title: "브리디 — 강아지·고양이부터 곤충·파충류까지 키우는 사람들이 모이는 곳",
      text: "사진 기록·질문·분양·경매·혈통카드까지, 브리디 앱 받아 보세요",
      url: DOWNLOAD_PAGE_PATH,
    });

  return (
    <div className="break-keep bg-app-bg pb-10 text-app-text">
      {/* 위 줄: 로고 · 웹으로 보기 */}
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="브리디 홈">
          <Image src="/landing/app-icon.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="text-[18px] font-bold">브리디</span>
        </Link>
        <Link href="/" className="text-[14px] font-semibold text-app-muted">
          웹으로 보기
        </Link>
      </div>

      {/* 첫 화면 */}
      <section className="px-4 pt-6">
        <Image src="/landing/app-icon.png" alt="브리디 앱 아이콘" width={72} height={72} className="rounded-2xl" priority />
        <h1 className="mt-5 text-[26px] font-bold leading-[36px] tracking-[-0.6px]">
          강아지·고양이부터
          <br />
          곤충·파충류·물고기까지
          <br />
          키우는 사람들이 모이는 곳
        </h1>
        <p className="mt-3 text-[16px] leading-[25px] text-app-sub">
          사진으로 기록하고, 궁금한 건 같은 종 키우는 사람에게 묻고, 분양·경매까지 한 앱에서 해요.
        </p>
        <div className="mt-6">
          <StoreBadges playFirst={playFirst} />
        </div>
        <Link
          href="/"
          className="mt-3 flex h-12 items-center justify-center rounded-md bg-app-surface text-[15px] font-semibold text-app-text"
        >
          설치 없이 웹에서 바로 써보기
        </Link>
        <p className="mt-2.5 text-center text-[13px] text-app-muted">무료로 받을 수 있어요</p>
      </section>

      {/* 화면 소개 */}
      <section aria-label="앱 화면" className="pt-8">
        <HorizontalRail label="앱 화면" className="snap-x snap-mandatory scroll-px-4 gap-3 px-4">
          {SCREENS.map((s) => (
            <span key={s.src} className="block w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-app-line">
              <Image src={s.src} alt={s.alt} width={600} height={1303} sizes="220px" className="h-auto w-full" />
            </span>
          ))}
        </HorizontalRail>
      </section>

      <div className="mt-8 h-2 bg-app-gap" />

      {/* 할 수 있는 것 */}
      <section className="px-4 pt-6">
        <h2 className="text-[20px] font-bold leading-7 tracking-[-0.5px]">브리디에서 할 수 있는 것</h2>
        <ul className="mt-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3 border-b border-app-line py-4 last:border-b-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-surface text-app-text">
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
          className="mt-2 flex items-center justify-between border-t border-app-line py-4 text-[15px] font-semibold"
        >
          처음 키운다면, 종별 사육 가이드
          <span className="text-[13px] font-normal text-app-muted">보러 가기 ›</span>
        </Link>
      </section>

      <div className="h-2 bg-app-gap" />

      {/* 마무리 */}
      <section className="px-4 pt-8 text-center">
        <h2 className="text-[20px] font-bold leading-7">지금 받아 보세요</h2>
        <p className="mt-1.5 text-[14px] text-app-muted">아이폰·안드로이드 모두 있어요</p>
        <div className="mt-5 flex justify-center">
          <StoreBadges playFirst={playFirst} />
        </div>
        <button
          type="button"
          onClick={share}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-app-border text-[15px] font-semibold text-app-text"
        >
          <Icon d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" size={20} />
          친구에게 링크 공유하기
        </button>
        <p className="mt-6 text-[13px] text-app-muted">
          문의는 <Link href="/support" className="underline underline-offset-2">고객센터</Link>로 남겨 주세요
        </p>
      </section>
    </div>
  );
}
