"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "react-toastify";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useConfirmDialog from "hooks/useConfirmDialog";

export default function AdminPostsPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeDescription, setNoticeDescription] = useState("");
  const [creatingNotice, setCreatingNotice] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data, mutate } = useSWR(
    `/api/admin/posts?page=${page}&keyword=${searchQuery}`
  );

  const handleCreateNotice = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!noticeTitle.trim() || !noticeDescription.trim()) {
      toast.error("공지 제목과 내용을 입력해주세요.");
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
      const result = await res.json();
      if (result.success) {
        toast.success("공지사항이 등록되었습니다.");
        setNoticeTitle("");
        setNoticeDescription("");
        mutate();
      } else {
        toast.error(result.error || "공지 등록 실패");
      }
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setCreatingNotice(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "이 게시글을 삭제할까요?",
      description: "삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/posts?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("게시글이 삭제되었습니다.");
        mutate();
      } else {
        toast.error(result.error || "삭제 실패");
      }
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(keyword);
  };

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">게시물 관리</h2>

        <form
          onSubmit={handleCreateNotice}
          className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-800">공지사항 작성</h3>
          <Input
            placeholder="공지 제목"
            value={noticeTitle}
            onChange={(event) => setNoticeTitle(event.target.value)}
          />
          <Textarea
            placeholder="공지 내용을 입력하세요"
            value={noticeDescription}
            onChange={(event) => setNoticeDescription(event.target.value)}
            rows={5}
          />
          <Button type="submit" disabled={creatingNotice}>
            {creatingNotice ? "등록 중..." : "공지 등록"}
          </Button>
        </form>

        <form onSubmit={handleSearch} className="flex max-w-md flex-col gap-2 sm:flex-row">
          <Input
            placeholder="제목, 내용, 작성자 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button type="submit">검색</Button>
        </form>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  제목/내용
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  작성자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  좋아요/댓글
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  등록일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.posts?.map((post: any) => (
                <tr key={post.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {post.category === "공지" && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                          공지
                        </span>
                      )}
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        <Link href={`/posts/${post.id}`} target="_blank" className="hover:underline">
                          {post.title}
                        </Link>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 line-clamp-1 mt-1">
                      <Link href={`/posts/${post.id}`} target="_blank" className="hover:underline">
                        {post.description}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {post.user?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ❤️ {post._count?.Likes || 0} / 💬 {post._count?.comments || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(post.id)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}

              {data?.posts?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    게시글이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} / {data?.totalPages || 1}
          </span>
          <Button
            variant="outline"
            disabled={page >= (data?.totalPages || 1)}
            onClick={() => setPage((prev) => prev + 1)}
          >
            다음
          </Button>
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
