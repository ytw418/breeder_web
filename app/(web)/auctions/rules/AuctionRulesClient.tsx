"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import {
  AUCTION_BID_INCREMENT_RANGE_TEXT,
  AUCTION_BID_INCREMENT_RULES,
  AUCTION_EDIT_WINDOW_MS,
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MAX_ACTIVE_PER_USER,
  AUCTION_MAX_DURATION_MS,
  AUCTION_MIN_DURATION_MS,
} from "@libs/auctionRules";

const REPORT_EMAIL = "bredyteam@gmail.com";

const hourText = (ms: number) => `${Math.floor(ms / (1000 * 60 * 60))}시간`;
const minuteText = (ms: number) => `${Math.floor(ms / (1000 * 60))}분`;

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-7 text-[16px] font-bold text-app-text">{children}</h2>;
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="mt-2.5 flex text-[15px] leading-[22px] text-app-text">
      <span aria-hidden className="w-3.5 shrink-0">
        •
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[15px] leading-[22px] text-app-text">{children}</p>;
}

function Strong({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-app-brand">{children}</span>;
}

/** 경매 운영 룰(앱 auctions/rules.tsx): 평평한 제목 + 글머리표 섹션, 주황 링크. */
export default function AuctionRulesClient() {
  return (
    <Layout canGoBack title="경매 운영 룰" seoTitle="경매 운영 룰">
      <div className="bg-app-bg px-5 pt-5 pb-12">
        <h1 className="text-[18px] font-bold text-app-text">경매를 시작하기 전에 꼭 확인하세요</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-app-muted">입찰과 마감은 아래 룰대로 자동 처리돼요.</p>

        <SectionTitle>기본 경매 규칙</SectionTitle>
        <ul>
          <Bullet>
            경매 기간은 {hourText(AUCTION_MIN_DURATION_MS)} ~ {hourText(AUCTION_MAX_DURATION_MS)} 사이로 설정됩니다.
          </Bullet>
          <Bullet>
            입찰 단위는 판매자가 등록할 때 정합니다({AUCTION_BID_INCREMENT_RANGE_TEXT}). 입찰은 현재가에서 이
            단위만큼 올라갑니다.
          </Bullet>
          <Bullet>
            마감 {minuteText(AUCTION_EXTENSION_WINDOW_MS)} 이내 입찰이 들어오면 경매 시간이{" "}
            <Strong>{minuteText(AUCTION_EXTENSION_MS)} 자동 연장</Strong>됩니다.
          </Bullet>
          <Bullet>입찰은 취소할 수 없으며, 본인 경매 입찰은 불가능합니다.</Bullet>
          <Bullet>카카오 로그인 기반 계정은 정책 위반 시 영구 참여 제한될 수 있습니다.</Bullet>
        </ul>

        <SectionTitle>추천 입찰 단위(시작가 기준)</SectionTitle>
        <ul>
          {AUCTION_BID_INCREMENT_RULES.map((rule) => (
            <Bullet key={rule.label}>
              {rule.label}: {rule.increment.toLocaleString()}원 단위
            </Bullet>
          ))}
        </ul>

        <SectionTitle>등록 · 수정 제한</SectionTitle>
        <ul>
          <Bullet>동시 진행 경매는 계정당 최대 {AUCTION_MAX_ACTIVE_PER_USER}개까지 등록할 수 있습니다.</Bullet>
          <Bullet>
            시작가 {AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상 경매는 연락처(전화/이메일) 정보가
            필요합니다.
          </Bullet>
          <Bullet>
            경매 수정은 진행중 상태에서 등록 후 <Strong>{minuteText(AUCTION_EDIT_WINDOW_MS)} 이내</Strong>, 입찰이 없을
            때만 허용됩니다.
          </Bullet>
          <Bullet>판매자는 블로그 URL, 카페/밴드 닉네임, 프로필 캡처를 선택적으로 등록할 수 있습니다.</Bullet>
        </ul>

        <SectionTitle>분쟁 및 신고</SectionTitle>
        <Paragraph>
          본 서비스는 거래 당사자 간 분쟁에 대해 법적 책임을 지지 않습니다. 허위 매물, 미발송, 환불 분쟁 등 문제가
          발생하면 신고를 접수해 운영정책에 따라 검토 및 제재합니다.
        </Paragraph>
        <a
          href={`mailto:${REPORT_EMAIL}?subject=[경매%20신고]%20문제%20접수`}
          className="mt-2.5 inline-flex text-[15px] font-semibold text-app-brand"
        >
          신고 접수: {REPORT_EMAIL}
        </a>

        <SectionTitle>더 알아보기</SectionTitle>
        <Paragraph>사진 · 설명 작성 가이드는 경매 등록 화면에서 다시 확인할 수 있어요.</Paragraph>
        <Link href="/auctions/create" className="mt-2.5 inline-flex text-[15px] font-semibold text-app-brand">
          경매 등록 화면으로 가기
        </Link>
      </div>
    </Layout>
  );
}
