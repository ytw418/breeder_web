"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useUser from "hooks/useUser";

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
    title: "고객의 소리",
    description: "버그 제보/기능 요청/개발팀 요청 접수 상태를 확인하고 응답합니다.",
    href: "/admin/voice",
  },
  {
    title: "상품 관리",
    description: "상품 검색, 확인, 삭제를 수행합니다.",
    href: "/admin/products",
  },
];

const SERVICE_FEATURES = [
  {
    title: "커뮤니티",
    description: "유저가 게시글과 댓글로 소통하고, 공지/필독 정보를 확인합니다.",
  },
  {
    title: "마켓",
    description: "판매 상품 등록, 상태 변경, 거래 관련 문의 응대를 진행합니다.",
  },
  {
    title: "경매",
    description: "경매 등록/입찰/종료 흐름을 운영하고 이상 케이스를 점검합니다.",
  },
  {
    title: "브리디북",
    description: "기네스 기록 신청을 심사하고 승인/반려 사유를 관리합니다.",
  },
];

const ADMIN_ONBOARDING_STEPS = [
  {
    title: "1. 공지부터 확인",
    description: "오늘 공지/이슈 공유가 필요한지 먼저 확인하고 필요한 공지를 등록합니다.",
  },
  {
    title: "2. 핵심 메뉴 점검",
    description: "경매 관리, 게시물 관리, 유저 관리 메뉴를 순서대로 열어 이상 여부를 확인합니다.",
  },
  {
    title: "3. 운영 조치 기록",
    description: "삭제/권한 변경/승인·반려 같은 조치가 있었다면 사유를 팀에 공유합니다.",
  },
];

const ADMIN_RULES = [
  "삭제/권한 변경은 반드시 대상과 사유를 다시 확인하고 진행하세요.",
  "공지 작성 시 제목에 핵심 요약을 먼저 쓰고, 본문에는 적용 시점과 대상 범위를 적으세요.",
  "문제가 애매하면 즉시 처리보다 보류 후 팀에 확인하는 것이 안전합니다.",
];

const ADMIN_TABS = [
  { id: "onboarding", label: "온보딩" },
  { id: "notice", label: "공지사항 등록" },
] as const;

const SENSITIVE_ACTION_ALLOWED_EMAILS = [
  "ytw418@naver.com",
  "ytw418@gmail.com",
] as const;

export default function AdminDashboardPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<(typeof ADMIN_TABS)[number]["id"]>(
    "onboarding"
  );
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
  const normalizedUserEmail = String(user?.email || "")
    .trim()
    .toLowerCase();
  const canRunSensitiveAdminActions =
    normalizedUserEmail !== "" &&
    SENSITIVE_ACTION_ALLOWED_EMAILS.includes(
      normalizedUserEmail as (typeof SENSITIVE_ACTION_ALLOWED_EMAILS)[number]
    );

  const handleBootstrapServiceData = async () => {
    if (!canRunSensitiveAdminActions) {
      setBootstrapError(
        "데이터 생성은 지정된 운영 계정(ytw418@naver.com, ytw418@gmail.com)에서만 가능합니다."
      );
      setBootstrapMessage("");
      return;
    }

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

    if (!canRunSensitiveAdminActions) {
      setGrantError(
        "관리자 권한 부여는 지정된 운영 계정(ytw418@naver.com, ytw418@gmail.com)에서만 가능합니다."
      );
      return;
    }

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
        <h2 className="text-2xl font-bold text-gray-900">어드민 온보딩</h2>
        <p className="mt-1 text-sm text-gray-500">
          처음 운영을 맡는 사람이 서비스 구조와 관리 방법을 빠르게 익히는 페이지입니다.
        </p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeTab === tab.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "onboarding" && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-800">서비스 기능 요약</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {SERVICE_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="text-sm font-semibold text-gray-900">{feature.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-800">어드민 사용 순서</p>
            <div className="mt-3 space-y-2">
              {ADMIN_ONBOARDING_STEPS.map((step) => (
                <div key={step.title} className="rounded-lg border border-gray-100 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-800">어드민 메뉴 설명</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {DASHBOARD_MENUS.map((menu) => (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className="rounded-lg border border-gray-100 px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <p className="font-semibold text-gray-900">{menu.title}</p>
                  <p className="mt-1 text-gray-600">{menu.description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">운영 시 주의사항</p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-900/90">
              {ADMIN_RULES.map((rule) => (
                <li key={rule} className="leading-relaxed">
                  • {rule}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-800">실행 도구 (운영자 전용)</p>
            <p className="mt-1 text-sm text-gray-500">
              아래 기능은 실제 데이터를 변경합니다. 온보딩 확인 후 사용하세요.
            </p>

            <div className="mt-4 space-y-5">
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-base font-semibold text-gray-900">1) 데이터 생성 (중요)</p>
                <p className="mt-1 text-sm text-gray-500">
                  버튼을 누를 때마다 신규 데이터가 누적 추가됩니다.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  허용 계정: ytw418@naver.com, ytw418@gmail.com
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  현재 로그인: {normalizedUserEmail || "확인 불가"}
                </p>
                <Button
                  type="button"
                  onClick={handleBootstrapServiceData}
                  disabled={isGenerating || !canRunSensitiveAdminActions}
                  className="mt-3 h-11 w-full text-base font-bold md:w-auto md:px-8"
                >
                  {isGenerating ? "생성 중..." : "데이터 생성하기"}
                </Button>

                {bootstrapMessage ? (
                  <p className="mt-3 text-sm font-medium text-emerald-600">
                    {bootstrapMessage}
                  </p>
                ) : null}
                {bootstrapError ? (
                  <p className="mt-3 text-sm font-medium text-rose-600">{bootstrapError}</p>
                ) : null}

                {bootstrapSummary ? (
                  <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                    {Object.entries(bootstrapSummary).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                      >
                        <p className="font-semibold text-gray-900">{key}</p>
                        <p className="mt-1">
                          생성 {value.created} / 업데이트 {value.updated} / 스킵 {value.skipped}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-base font-semibold text-gray-900">2) 관리자 계정 부여</p>
                <p className="mt-1 text-sm text-gray-500">
                  동생/운영팀 이메일을 입력하면 즉시 ADMIN 권한을 부여합니다.
                </p>
                <form onSubmit={handleGrantAdmins} className="mt-3 space-y-3">
                  <Textarea
                    rows={3}
                    placeholder={
                      "이메일 입력 (쉼표/줄바꿈 가능)\nexample1@email.com, example2@email.com"
                    }
                    value={adminEmails}
                    onChange={(event) => setAdminEmails(event.target.value)}
                  />
                  <Button
                    type="submit"
                    disabled={grantingAdmin || !canRunSensitiveAdminActions}
                    className="w-full md:w-auto"
                  >
                    {grantingAdmin ? "처리 중..." : "관리자 권한 부여"}
                  </Button>
                </form>
                {!canRunSensitiveAdminActions ? (
                  <p className="mt-2 text-xs text-amber-700">
                    관리자 권한 부여는 지정된 운영 계정에서만 가능합니다.
                  </p>
                ) : null}
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
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-800">빠른 이동</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {DASHBOARD_MENUS.map((menu) => (
                <Link
                  key={`${menu.href}-quick`}
                  href={menu.href}
                  className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {menu.title}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "notice" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-lg font-semibold text-gray-900">공지사항 등록</p>
          <p className="mt-1 text-sm text-gray-500">
            전체 사용자에게 전달할 운영 공지를 작성합니다.
          </p>
          <form onSubmit={handleCreateNotice} className="mt-4 space-y-3">
            <Input
              placeholder="공지 제목"
              value={noticeTitle}
              onChange={(event) => setNoticeTitle(event.target.value)}
            />
            <Textarea
              rows={7}
              placeholder="공지 내용"
              value={noticeDescription}
              onChange={(event) => setNoticeDescription(event.target.value)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={creatingNotice} className="w-full sm:w-auto">
                {creatingNotice ? "등록 중..." : "공지 등록하기"}
              </Button>
              <Link
                href="/posts/notices"
                className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                등록된 공지 보기
              </Link>
            </div>
          </form>
          {noticeMessage ? (
            <p className="mt-3 text-sm font-medium text-emerald-600">{noticeMessage}</p>
          ) : null}
          {noticeError ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{noticeError}</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
