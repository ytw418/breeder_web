"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import MarkdownEditor from "@components/features/product/MarkdownEditor";
import { LandingPageRecord } from "pages/api/admin/landing-pages";
import useConfirmDialog from "hooks/useConfirmDialog";

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

const buildLandingPath = (slug: string) => `/content/${slug}`;

export default function AdminLandingPagesPage() {
  const { data, mutate } = useSWR<LandingPagesResponse>("/api/admin/landing-pages");
  const { confirm, confirmDialog } = useConfirmDialog();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [latestCreatedLink, setLatestCreatedLink] = useState("");

  const editingPage = useMemo(
    () => data?.pages?.find((page) => page.id === editingId),
    [data?.pages, editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setPagePath("");
    setContent("");
    setIsPublished(true);
  };

  const copyLandingLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("링크를 복사했습니다.");
    } catch {
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  const handleEdit = (page: LandingPageRecord) => {
    setEditingId(page.id);
    setTitle(page.title);
    setPagePath(page.slug);
    setContent(page.content);
    setIsPublished(page.isPublished);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !pagePath.trim() || !content.trim()) {
      toast.error("제목, 페이지 주소, 내용을 입력해주세요.");
      return;
    }

    try {
      setSaving(true);
      const payload = editingId
        ? {
            action: "update",
            id: editingId,
            title: title.trim(),
            slug: pagePath.trim(),
            content,
            isPublished,
          }
        : {
            action: "create",
            title: title.trim(),
            slug: pagePath.trim(),
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

      if (result.page?.slug) {
        setLatestCreatedLink(buildLandingPath(result.page.slug));
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
    const confirmed = await confirm({
      title: "이 페이지를 삭제할까요?",
      description: "삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
    });
    if (!confirmed) return;

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
    <>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">랜딩 페이지 관리</h2>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-900">랜딩 페이지란?</p>
          <p className="text-sm text-emerald-800">
            배너를 눌렀을 때 열리는 안내 페이지입니다. 이벤트 안내, 공지, 프로모션 내용을 쉽게 보여줄 수 있습니다.
          </p>
          <p className="text-sm text-emerald-800">
            작성 후 <span className="font-semibold">공개 상태로 저장</span>하면 배너 연결용 링크가 자동 생성됩니다.
          </p>
          <p className="text-sm text-emerald-800">
            생성된 링크는 아래 목록에서 바로 복사해서
            {" "}
            <Link href="/admin/banners" className="font-semibold underline underline-offset-2">
              배너 관리
            </Link>
            에 붙여넣으면 됩니다.
          </p>
        </div>

        {latestCreatedLink ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">방금 저장한 링크</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-md bg-white px-3 py-2 text-sm font-mono text-gray-800">
                {latestCreatedLink}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => copyLandingLink(latestCreatedLink)}
              >
                링크 복사
              </Button>
            </div>
          </div>
        ) : null}

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

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="페이지 주소 (예: spring-event)"
            value={pagePath}
            onChange={(event) => setPagePath(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setPagePath(makeSlug(title))}
          >
            제목으로 주소 만들기
          </Button>
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

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] divide-y divide-gray-200">
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-gray-500 font-mono">{buildLandingPath(page.slug)}</p>
                      <button
                        type="button"
                        onClick={() => copyLandingLink(buildLandingPath(page.slug))}
                        className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
                      >
                        링크 복사
                      </button>
                    </div>
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
      </div>
      {confirmDialog}
    </>
  );
}
