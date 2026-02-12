"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";

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

type NoticeResponse = {
  success?: boolean;
  error?: string;
};

type GrantAdminResponse = {
  success?: boolean;
  error?: string;
  updatedCount?: number;
  foundCount?: number;
  notFoundEmails?: string[];
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
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeDescription, setNoticeDescription] = useState("");
  const [creatingNotice, setCreatingNotice] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeError, setNoticeError] = useState("");
  const [adminEmails, setAdminEmails] = useState("");
  const [grantingAdmin, setGrantingAdmin] = useState(false);
  const [grantMessage, setGrantMessage] = useState("");
  const [grantError, setGrantError] = useState("");
  const [notFoundEmails, setNotFoundEmails] = useState<string[]>([]);

  const handleBootstrapServiceData = async () => {
    const shouldProceed = window.confirm(
      "실서비스 초기 데이터를 생성합니다. 기존 데이터는 유지되며, 클릭할 때마다 신규 데이터가 추가됩니다. 계속하시겠습니까?"
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
      setBootstrapMessage(data.message || "초기 데이터 신규 추가가 완료되었습니다.");
    } catch (error) {
      setBootstrapSummary(null);
      setBootstrapError(error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateNotice = async (event: React.FormEvent) => {
    event.preventDefault();
    setNoticeError("");
    setNoticeMessage("");

    if (!noticeTitle.trim() || !noticeDescription.trim()) {
      setNoticeError("공지 제목과 내용을 입력해주세요.");
      return;
    }

    try {
      setCreatingNotice(true);
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_notice",
          title: noticeTitle.trim(),
          description: noticeDescription.trim(),
        }),
      });
      const data = (await res.json()) as NoticeResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || "공지 등록에 실패했습니다.");
      }
      setNoticeTitle("");
      setNoticeDescription("");
      setNoticeMessage("공지사항 등록 완료");
    } catch (error) {
      setNoticeError(error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setCreatingNotice(false);
    }
  };

  const handleGrantAdmins = async (event: React.FormEvent) => {
    event.preventDefault();
    setGrantError("");
    setGrantMessage("");
    setNotFoundEmails([]);

    const emails = Array.from(
      new Set(
        adminEmails
          .split(/[\n,\s]+/)
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.includes("@"))
      )
    );

    if (!emails.length) {
      setGrantError("이메일을 1개 이상 입력해주세요.");
      return;
    }

    try {
      setGrantingAdmin(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant_admin_by_email",
          emails,
        }),
      });
      const data = (await res.json()) as GrantAdminResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || "관리자 권한 부여에 실패했습니다.");
      }
      setGrantMessage(
        `완료: 대상 ${data.foundCount || 0}명, 신규 관리자 전환 ${data.updatedCount || 0}명`
      );
      setNotFoundEmails(data.notFoundEmails || []);
    } catch (error) {
      setGrantError(error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setGrantingAdmin(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-900">어드민 빠른 실행</h2>
        <p className="mt-1 text-sm text-gray-500">
          핵심 작업 3개를 이 화면에서 바로 처리합니다.
        </p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-lg font-semibold text-gray-900">1) 데이터 생성 (중요)</p>
        <p className="mt-2 text-sm text-gray-500">
          버튼을 누를 때마다 신규 데이터가 누적 추가됩니다.
        </p>
        <Button
          type="button"
          onClick={handleBootstrapServiceData}
          disabled={isGenerating}
          className="mt-4 h-12 w-full text-base font-bold md:w-auto md:px-8"
        >
          {isGenerating ? "생성 중..." : "데이터 생성하기"}
        </Button>

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

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-lg font-semibold text-gray-900">2) 공지사항 생성</p>
        <form onSubmit={handleCreateNotice} className="mt-3 space-y-3">
          <Input
            placeholder="공지 제목"
            value={noticeTitle}
            onChange={(event) => setNoticeTitle(event.target.value)}
          />
          <Textarea
            rows={5}
            placeholder="공지 내용"
            value={noticeDescription}
            onChange={(event) => setNoticeDescription(event.target.value)}
          />
          <Button type="submit" disabled={creatingNotice} className="w-full md:w-auto">
            {creatingNotice ? "등록 중..." : "공지 등록하기"}
          </Button>
        </form>
        {noticeMessage ? (
          <p className="mt-3 text-sm font-medium text-emerald-600">{noticeMessage}</p>
        ) : null}
        {noticeError ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{noticeError}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-lg font-semibold text-gray-900">3) 관리자 계정 부여</p>
        <p className="mt-1 text-sm text-gray-500">
          여친/동생 이메일을 입력하면 즉시 ADMIN 권한을 부여합니다.
        </p>
        <form onSubmit={handleGrantAdmins} className="mt-3 space-y-3">
          <Textarea
            rows={3}
            placeholder={"이메일 입력 (쉼표/줄바꿈 가능)\nexample1@email.com, example2@email.com"}
            value={adminEmails}
            onChange={(event) => setAdminEmails(event.target.value)}
          />
          <Button type="submit" disabled={grantingAdmin} className="w-full md:w-auto">
            {grantingAdmin ? "처리 중..." : "관리자 권한 부여"}
          </Button>
        </form>
        {grantMessage ? (
          <p className="mt-3 text-sm font-medium text-emerald-600">{grantMessage}</p>
        ) : null}
        {grantError ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{grantError}</p>
        ) : null}
        {notFoundEmails.length ? (
          <p className="mt-2 text-xs text-amber-700">
            계정 없음: {notFoundEmails.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-800">기타 관리자 메뉴</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {DASHBOARD_MENUS.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {menu.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
