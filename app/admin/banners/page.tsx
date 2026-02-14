"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { cn } from "@libs/client/utils";
import useConfirmDialog from "hooks/useConfirmDialog";

interface BannerItem {
  id: number;
  title: string;
  description: string;
  href: string;
  bgClass: string;
  order: number;
}

interface BannerResponse {
  success: boolean;
  banners: BannerItem[];
  isSample?: boolean;
}

interface LandingPagesResponse {
  success: boolean;
  pages: {
    id: number;
    slug: string;
    title: string;
    isPublished: boolean;
  }[];
}

const HREF_EXAMPLES = [
  {
    label: "랜딩 페이지",
    value: "/content/spring-event",
  },
  {
    label: "사이트 내부",
    value: "/ranking",
  },
  {
    label: "외부 링크",
    value: "https://example.com/event",
  },
];

const BANNER_STYLE_PRESETS = [
  { label: "에메랄드", bgClass: "from-emerald-500 to-teal-500" },
  { label: "스카이", bgClass: "from-sky-500 to-cyan-500" },
  { label: "퍼플 블루", bgClass: "from-indigo-500 to-blue-500" },
  { label: "로즈 핑크", bgClass: "from-rose-500 to-pink-500" },
  { label: "선셋 오렌지", bgClass: "from-orange-500 to-amber-500" },
  { label: "라임 그린", bgClass: "from-lime-500 to-emerald-500" },
  { label: "딥 네이비", bgClass: "from-slate-700 to-slate-900" },
  { label: "코랄", bgClass: "from-red-500 to-orange-500" },
] as const;

const DEFAULT_BANNER_STYLE = BANNER_STYLE_PRESETS[0].bgClass;

const getHrefGuide = (href: string) => {
  const value = href.trim();
  if (!value) {
    return "링크를 입력하면 이동 방식 안내가 표시됩니다.";
  }

  if (/^https?:\/\//i.test(value)) {
    return "외부 URL 링크입니다. 예: https://...";
  }

  if (/^\/content\/[a-z0-9-]+$/.test(value)) {
    return "랜딩 페이지 링크 형식이 맞습니다.";
  }

  if (value.startsWith("/")) {
    return "사이트 내부 경로 링크입니다.";
  }

  return "권장 형식이 아닙니다. /path 또는 https://... 형식을 사용하세요.";
};

export default function AdminBannersPage() {
  const { data, mutate } = useSWR<BannerResponse>("/api/admin/banners");
  const { data: landingPagesData } =
    useSWR<LandingPagesResponse>("/api/admin/landing-pages");
  const { confirm, confirmDialog } = useConfirmDialog();
  const [form, setForm] = useState({
    title: "",
    description: "",
    href: "/",
    bgClass: DEFAULT_BANNER_STYLE,
    order: "1",
  });

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim() || !form.href.trim()) {
      toast.error("제목, 설명, 링크는 필수입니다.");
      return;
    }

    try {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          href: form.href,
          bgClass: form.bgClass,
          order: Number(form.order),
        }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "배너 생성 실패");
      }
      toast.success("배너가 생성되었습니다.");
      setForm({
        title: "",
        description: "",
        href: "/",
        bgClass: DEFAULT_BANNER_STYLE,
        order: "1",
      });
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "이 배너를 삭제할까요?",
      description: "삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/banners?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "삭제 실패");
      }
      toast.success("배너가 삭제되었습니다.");
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-gray-900">배너 관리</h2>
          {data?.isSample && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              샘플 데이터 표시중
            </span>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">처음이면 이렇게 진행하세요</p>
          <p className="text-sm text-blue-800">
            1) 배너를 눌렀을 때 보여줄 페이지가 필요하면 먼저
            {" "}
            <Link href="/admin/landing-pages" className="font-semibold underline underline-offset-2">
              랜딩 페이지 관리
            </Link>
            에서 페이지를 만드세요.
          </p>
          <p className="text-sm text-blue-800">
            2) 이미 만들어둔 다른 페이지가 있다면 그 링크를 그대로 사용해도 됩니다.
          </p>
          <p className="text-sm text-blue-800">
            3) 아래 배너 생성 폼의 <span className="font-semibold">링크</span> 칸에 붙여넣고 저장하면 끝입니다.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
        >
        <h3 className="text-sm font-semibold text-gray-800">새 배너 추가</h3>
        <Input
          placeholder="제목"
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        />
        <Input
          placeholder="설명"
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
        />
        <Input
          placeholder="링크 (/search 또는 https://...)"
          value={form.href}
          onChange={(event) => setForm((prev) => ({ ...prev, href: event.target.value }))}
        />
        <div className="rounded-md bg-gray-50 border border-gray-100 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-800">링크 입력 가이드</p>
          <p className="text-xs text-gray-600">
            1) 랜딩 페이지를 만들려면:
            {" "}
            <Link href="/admin/landing-pages" className="font-semibold underline underline-offset-2">
              /admin/landing-pages
            </Link>
          </p>
          <p className="text-xs text-gray-600">
            2) 배너 링크 입력: <span className="font-mono">/content/slug</span> 또는 내부경로(
            <span className="font-mono">/ranking</span>) 또는 외부URL(
            <span className="font-mono">https://...</span>)
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {HREF_EXAMPLES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, href: item.value }))}
                className="px-2 py-1 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-100"
              >
                {item.label}: <span className="font-mono">{item.value}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1.5">
            현재 링크 상태: {getHrefGuide(form.href)}
          </p>
        </div>
        {landingPagesData?.pages?.length ? (
          <div className="flex flex-wrap gap-2">
            {landingPagesData.pages
              .filter((page) => page.isPublished)
              .slice(0, 6)
              .map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, href: `/content/${page.slug}` }))
                  }
                  className="px-2 py-1 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                >
                  페이지 선택: {page.title}
                </button>
              ))}
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-800">배너 컬러 스타일</p>
          <p className="text-xs text-gray-600">
            직접 입력 없이, 아래 스타일 중 하나를 선택하세요.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BANNER_STYLE_PRESETS.map((preset) => {
              const isSelected = form.bgClass === preset.bgClass;
              return (
                <button
                  key={preset.bgClass}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, bgClass: preset.bgClass }))
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full bg-gradient-to-r ring-1 ring-black/10",
                      preset.bgClass
                    )}
                  />
                  <span className="font-medium">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="number"
            placeholder="정렬순서"
            value={form.order}
            onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
          />
        </div>
        <Button type="submit">배너 생성</Button>
        </form>

        <div className="space-y-3">
          {(data?.banners || []).map((banner) => (
            <div key={banner.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{banner.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{banner.description}</p>
                  <p className="text-xs text-gray-400 mt-2">링크: {banner.href}</p>
                  <p className="text-xs text-gray-400">스타일: {banner.bgClass}</p>
                  <p className="text-xs text-gray-400">정렬: {banner.order}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={Boolean(data?.isSample)}
                  onClick={() => handleDelete(banner.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}

          {data?.banners?.length === 0 && (
            <div className="text-sm text-gray-500 bg-white rounded-lg border border-gray-200 p-6 text-center">
              배너 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
