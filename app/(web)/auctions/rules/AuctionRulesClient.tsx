"use client";

import Link from "next/link";
import Layout from "@components/features/MainLayout";
import {
  AUCTION_EDIT_WINDOW_MS,
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MAX_ACTIVE_PER_USER,
  AUCTION_MAX_DURATION_MS,
  AUCTION_MIN_DURATION_MS,
} from "@libs/auctionRules";

const hourText = (ms: number) => `${Math.floor(ms / (1000 * 60 * 60))}시간`;
const minuteText = (ms: number) => `${Math.floor(ms / (1000 * 60))}분`;

export default function AuctionRulesClient() {
  return (
    <Layout canGoBack title="경매 룰 안내" seoTitle="경매 룰 안내">
      <div className="px-4 py-4 space-y-4 pb-10">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-bold text-slate-900">기본 경매 규칙</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
            <li>• 경매 기간은 {hourText(AUCTION_MIN_DURATION_MS)} ~ {hourText(AUCTION_MAX_DURATION_MS)} 사이로 설정됩니다.</li>
            <li>• 현재가 구간에 따라 입찰 단위가 자동 계산됩니다.</li>
            <li>• 마감 {minuteText(AUCTION_EXTENSION_WINDOW_MS)} 이내 입찰이 들어오면 경매 시간이 {minuteText(AUCTION_EXTENSION_MS)} 자동 연장됩니다.</li>
            <li>• 입찰은 취소할 수 없으며, 본인 경매 입찰은 불가능합니다.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-bold text-slate-900">등록/수정 제한</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
            <li>• 동시 진행 경매는 계정당 최대 {AUCTION_MAX_ACTIVE_PER_USER}개까지 등록할 수 있습니다.</li>
            <li>• 시작가 {AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상 경매는 연락처 등록 계정만 등록 가능합니다.</li>
            <li>• 경매 수정은 등록 후 {hourText(AUCTION_EDIT_WINDOW_MS)} 이내, 입찰이 없을 때만 허용됩니다.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-base font-bold text-amber-900">분쟁 및 신고 안내</h2>
          <p className="mt-2 text-sm text-amber-900 leading-relaxed">
            본 서비스는 거래 당사자 간 분쟁에 대해 법적 책임을 지지 않습니다.
            허위 매물, 미발송, 환불 분쟁 등 문제가 발생하면 신고를 접수해 운영정책에 따라 검토 및 제재합니다.
          </p>
          <a
            href="mailto:support@bredy.app?subject=[경매%20신고]%20문제%20접수"
            className="mt-2 inline-flex items-center text-sm font-semibold text-amber-900 underline underline-offset-2"
          >
            신고 접수: support@bredy.app
          </a>
        </section>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          더 자세한 상품 상태/사진/설명 가이드는
          {" "}
          <Link href="/auctions/create" className="font-semibold text-slate-900 underline underline-offset-2">
            경매 등록 화면
          </Link>
          에서 다시 확인할 수 있습니다.
        </div>
      </div>
    </Layout>
  );
}
