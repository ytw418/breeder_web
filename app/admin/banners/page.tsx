"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";

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

export default function AdminBannersPage() {
  const { data, mutate } = useSWR<BannerResponse>("/api/admin/banners");
  const [form, setForm] = useState({
    title: "",
    description: "",
    href: "/",
    bgClass: "from-emerald-500 to-teal-500",
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
        bgClass: "from-emerald-500 to-teal-500",
        order: "1",
      });
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 배너를 삭제하시겠습니까?")) return;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">배너 관리</h2>
        {data?.isSample && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
            샘플 데이터 표시중
          </span>
        )}
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
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="bgClass (예: from-sky-500 to-cyan-500)"
            value={form.bgClass}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, bgClass: event.target.value }))
            }
          />
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
            <div className="flex items-start justify-between gap-4">
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
  );
}

