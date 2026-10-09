"use client";

import { authFetch } from "@libs/client/authFetch";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "@libs/client/toast";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useContentActionDialog from "@components/features/moderation/useContentActionDialog";
import { toPostPath } from "@libs/post-route";
import { toPostPlainText } from "@libs/shared/post-body";

export default function AdminPostsPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  // 운영진 첫 댓글용: 최근 7일, 댓글이 하나도 없는 글
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { ask, dialog: contentActionDialog } = useContentActionDialog();
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeDescription, setNoticeDescription] = useState("");
  const [creatingNotice, setCreatingNotice] = useState(false);

  const { data, mutate } = useSWR(
    `/api/admin/posts?page=${page}&keyword=${searchQuery}${hiddenOnly ? "&hidden=1" : ""}${unansweredOnly ? "&unanswered=1" : ""}`
  );

  const handleCreateNotice = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!noticeTitle.trim() || !noticeDescription.trim()) {
      toast.error("공지 제목과 내용을 입력해주세요.");
      return;
    }

    try {
      setCreatingNotice(true);
      const res = await authFetch("/api/admin/posts", {
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

  /** 숨김·숨김 해제(주 동작). 숨김은 사유가 작성자 알림에 들어간다. */
  const handleVisibility = async (id: number, action: "hide" | "unhide") => {
    const result = await ask(
      action === "hide"
        ? {
            title: "이 게시글을 숨길까요?",
            description: "작성자에게만 보이고, 작성자에게 사유가 담긴 알림이 가요. 나중에 숨김을 해제할 수 있어요.",
            confirmText: "숨기기",
          }
        : {
            title: "숨김을 해제할까요?",
            description: "다시 모두에게 보이고, 작성자에게 알림이 가요.",
            confirmText: "숨김 해제",
            askReason: false,
          }
    );
    if (!result) return;

    try {
      setBusyId(id);
      const res = await authFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "POST",
          targetId: id,
          action,
          reasonCode: result.reasonCode,
          reason: result.reason || null,
        }),
      });
      const data = await res.json();
      if (!data.success) return toast.error(data.error || "처리하지 못했어요.");
      toast.success(action === "hide" ? "숨겼어요." : "숨김을 해제했어요.");
      mutate();
    } catch {
      toast.error("처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
    }
  };

  /** 삭제(보조 동작). 되돌릴 수 없어 키워드와 사유를 받는다. */
  const handleDelete = async (id: number) => {
    const result = await ask({
      title: "이 게시글을 삭제할까요?",
      description: "되돌릴 수 없어요. 대부분은 숨김으로 충분해요.",
      confirmText: "삭제",
      tone: "danger",
      confirmKeyword: "DELETE",
    });
    if (!result?.reasonCode) return;

    try {
      setBusyId(id);
      const params = new URLSearchParams({ id: String(id), reasonCode: result.reasonCode });
      if (result.reason) params.set("reason", result.reason);
      const res = await authFetch(`/api/admin/posts?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("게시글을 삭제했어요.");
        mutate();
      } else {
        toast.error(data.error || "삭제하지 못했어요.");
      }
    } catch {
      toast.error("삭제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
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
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hiddenOnly}
              onChange={(event) => {
                setHiddenOnly(event.target.checked);
                setPage(1);
              }}
            />
            숨김만
          </label>
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-700">
            <input
              type="checkbox"
              checked={unansweredOnly}
              onChange={(event) => {
                setUnansweredOnly(event.target.checked);
                setPage(1);
              }}
            />
            답 없는 글(7일)
          </label>
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
                      {post.isHidden ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
                          숨김
                        </span>
                      ) : null}
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        <Link href={toPostPath(post.id, post.title)} target="_blank" className="hover:underline">
                          {post.title}
                        </Link>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 line-clamp-1 mt-1">
                      <Link href={toPostPath(post.id, post.title)} target="_blank" className="hover:underline">
                        {toPostPlainText(post.description)}
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
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === post.id}
                        onClick={() => handleVisibility(post.id, post.isHidden ? "unhide" : "hide")}
                      >
                        {post.isHidden ? "숨김 해제" : "숨김"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500"
                        disabled={busyId === post.id}
                        onClick={() => handleDelete(post.id)}
                      >
                        삭제
                      </Button>
                    </div>
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
      {contentActionDialog}
    </>
  );
}
