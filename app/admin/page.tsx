"use client";

import Link from "next/link";
import { useState } from "react";

type CountStat = {
  created: number;
  updated: number;
  skipped: number;
};

type BootstrapSummary = {
  users: CountStat;
  follows: CountStat;
  products: CountStat;
  posts: CountStat;
  likes: CountStat;
  comments: CountStat;
  favs: CountStat;
  auctions: CountStat;
  bids: CountStat;
};

type BootstrapResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  summary?: BootstrapSummary;
};

const DASHBOARD_MENUS = [
  {
    title: "경매 관리",
    description: "경매 상태 제어 및 내부 룰/제약조건을 점검합니다.",
    href: "/admin/auctions",
  },
  {
    title: "배너 관리",
    description: "메인 상단 배너를 생성/삭제합니다.",
    href: "/admin/banners",
  },
  {
    title: "랜딩 페이지",
    description: "배너 링크로 연결할 간단한 페이지를 제작합니다.",
    href: "/admin/landing-pages",
  },
  {
    title: "기네스북 심사",
    description: "기네스북 신청 건을 검토하고 승인/반려합니다.",
    href: "/admin/guinness",
  },
  {
    title: "유저 관리",
    description: "유저 목록 확인, 권한 변경, 삭제를 수행합니다.",
    href: "/admin/users",
  },
  {
    title: "게시물 관리",
    description: "게시글 검색, 확인, 삭제를 수행합니다.",
    href: "/admin/posts",
  },
  {
    title: "상품 관리",
    description: "상품 검색, 확인, 삭제를 수행합니다.",
    href: "/admin/products",
  },
];

export default function AdminDashboardPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState("");
  const [bootstrapError, setBootstrapError] = useState("");
  const [bootstrapSummary, setBootstrapSummary] = useState<BootstrapSummary | null>(null);

  const handleBootstrapServiceData = async () => {
    const shouldProceed = window.confirm(
      "실서비스 초기 데이터를 생성합니다. 기존 데이터는 유지되고, 동일 키 데이터는 업데이트됩니다. 계속하시겠습니까?"
    );
    if (!shouldProceed) return;

    setIsGenerating(true);
    setBootstrapError("");
    setBootstrapMessage("");

    try {
      const res = await fetch("/api/admin/bootstrap-service-data", {
        method: "POST",
      });
      const data = (await res.json()) as BootstrapResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || "초기 데이터 생성에 실패했습니다.");
      }
      setBootstrapSummary(data.summary || null);
      setBootstrapMessage(data.message || "초기 데이터 생성이 완료되었습니다.");
    } catch (error) {
      setBootstrapSummary(null);
      setBootstrapError(error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">어드민 대시보드</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DASHBOARD_MENUS.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <p className="text-lg font-semibold text-gray-900">{menu.title}</p>
            <p className="mt-2 text-sm text-gray-500">{menu.description}</p>
            <p className="mt-4 text-sm font-semibold text-primary">바로가기</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-lg font-semibold text-gray-900">실서비스 초기 데이터 생성</p>
        <p className="mt-2 text-sm text-gray-500">
          서비스 체감 품질 확인을 위해 유저/상품/게시글/경매/상호작용 샘플 데이터를 생성합니다.
        </p>
        <button
          type="button"
          onClick={handleBootstrapServiceData}
          disabled={isGenerating}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "생성 중..." : "초기 데이터 생성하기"}
        </button>

        {bootstrapMessage ? (
          <p className="mt-3 text-sm font-medium text-emerald-600">{bootstrapMessage}</p>
        ) : null}
        {bootstrapError ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{bootstrapError}</p>
        ) : null}

        {bootstrapSummary ? (
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
            {Object.entries(bootstrapSummary).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="font-semibold text-gray-900">{key}</p>
                <p className="mt-1">
                  생성 {value.created} / 업데이트 {value.updated} / 스킵 {value.skipped}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
