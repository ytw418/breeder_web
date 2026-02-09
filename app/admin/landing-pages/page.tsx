"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import MarkdownEditor from "@components/features/product/MarkdownEditor";
import { LandingPageRecord } from "pages/api/admin/landing-pages";

interface LandingPagesResponse {
  success: boolean;
  pages: LandingPageRecord[];
}

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function AdminLandingPagesPage() {
  const { data, mutate } = useSWR<LandingPagesResponse>("/api/admin/landing-pages");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const editingPage = useMemo(
    () => data?.pages?.find((page) => page.id === editingId),
    [data?.pages, editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSlug("");
    setContent("");
    setIsPublished(true);
  };

  const handleEdit = (page: LandingPageRecord) => {
    setEditingId(page.id);
    setTitle(page.title);
    setSlug(page.slug);
    setContent(page.content);
    setIsPublished(page.isPublished);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !slug.trim() || !content.trim()) {
      toast.error("제목, 슬러그, 내용을 입력해주세요.");
      return;
    }

    try {
      setSaving(true);
      const payload = editingId
        ? {
            action: "update",
            id: editingId,
            title: title.trim(),
            slug: slug.trim(),
            content,
            isPublished,
          }
        : {
            action: "create",
            title: title.trim(),
            slug: slug.trim(),
            content,
            isPublished,
          };

      const res = await fetch("/api/admin/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!result.success) {
        return toast.error(result.error || "저장에 실패했습니다.");
      }

      toast.success(editingId ? "페이지가 수정되었습니다." : "페이지가 생성되었습니다.");
      resetForm();
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 페이지를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/admin/landing-pages?id=${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "삭제 실패");
      }
      toast.success("페이지가 삭제되었습니다.");
      if (editingId === id) resetForm();
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">랜딩 페이지 관리</h2>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-emerald-900">랜딩 페이지란?</p>
        <p className="text-sm text-emerald-800">
          배너를 눌렀을 때 열리는 안내 페이지입니다. 이벤트 안내, 공지, 프로모션 내용을 쉽게 보여줄 수 있습니다.
        </p>
        <p className="text-sm text-emerald-800">
          작성 후 <span className="font-semibold">공개 상태로 저장</span>하면 주소가
          {" "}
          <span className="font-mono">/content/슬러그</span>
          로 생성됩니다.
        </p>
        <p className="text-sm text-emerald-800">
          만든 주소는
          {" "}
          <Link href="/admin/banners" className="font-semibold underline underline-offset-2">
            배너 관리
          </Link>
          의 링크 칸에 넣어 연결하세요.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            {editingPage ? "페이지 수정" : "새 페이지 생성"}
          </h3>
          {editingPage && (
            <Button type="button" variant="outline" onClick={resetForm}>
              새로 만들기
            </Button>
          )}
        </div>

        <Input
          placeholder="페이지 제목"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div className="flex gap-2">
          <Input
            placeholder="slug (예: spring-event)"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setSlug(makeSlug(title))}
          >
            slug 자동생성
          </Button>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          공개 링크: <span className="font-mono text-gray-900">/content/{slug || "your-slug"}</span>
        </div>

        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="배너로 연결할 페이지 내용을 입력하세요"
          rows={10}
        />

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          공개 상태로 저장
        </label>

        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : editingPage ? "페이지 수정" : "페이지 생성"}
        </Button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                제목 / 링크
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                수정일
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.pages?.map((page) => (
              <tr key={page.id}>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{page.title}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    /content/{page.slug}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      page.isPublished
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {page.isPublished ? "공개" : "비공개"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(page.updatedAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Link
                    href={`/content/${page.slug}`}
                    target="_blank"
                    className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    보기
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(page)}>
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(page.id)}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}

            {data?.pages?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                  생성된 랜딩 페이지가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
