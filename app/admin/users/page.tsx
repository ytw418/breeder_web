"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@components/ui/button";
import { USER_STATUS_LABEL } from "@libs/shared/sanction";
import type { UserStatus } from "@prisma/client";

/**
 * 관리자 유저 목록(S-2): 닉네임·이메일·ID 검색 + 상태 필터 + 20명 페이지.
 * 행을 누르면 유저 상세(제재·이력)로 간다. 상태 변경·삭제는 유저 상세에서 한다(이력·알림을 남기려고).
 * 기획: 앱 docs/prd/admin-moderation.md
 */

const STATUS_FILTERS = [
  { value: "", label: "전체" },
  { value: "ACTIVE", label: "정상" },
  { value: "SUSPENDED", label: "기간 정지" },
  { value: "BANNED", label: "영구 정지" },
  { value: "DELETED", label: "탈퇴" },
] as const;

interface AdminUserRow {
  id: number;
  name: string;
  email: string | null;
  provider: string;
  role: string;
  status: UserStatus;
  suspendedUntil: string | null;
  createdAt: string;
  recentSanctionCount: number;
}

interface AdminUsersListResponse {
  success: boolean;
  users?: AdminUserRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

const statusTone = (status: UserStatus) =>
  status === "ACTIVE"
    ? "bg-emerald-50 text-emerald-700"
    : status === "BANNED"
      ? "bg-rose-100 text-rose-700"
      : status === "DELETED"
        ? "bg-gray-100 text-gray-500"
        : "bg-amber-50 text-amber-700";

export default function AdminUsersPage() {
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, error, isLoading, mutate } = useSWR<AdminUsersListResponse>(
    `/api/admin/users?q=${encodeURIComponent(query)}&status=${status}&page=${page}`
  );
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const failed = Boolean(error) || data?.success === false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">유저 관리</h2>
        <p className="mt-1 text-sm text-gray-500">
          유저를 찾아 상세에서 경고·정지·해제를 합니다. 모든 제재는 이력과 대상자 알림을 남깁니다.
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(keyword.trim());
          setPage(1);
        }}
      >
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="닉네임·이메일·ID"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          aria-label="상태"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          검색
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["ID", "이름", "이메일", "역할", "상태", "정지 만료", "최근 180일 제재", "가입일"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={8} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                      </td>
                    </tr>
                  ))
                : users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{user.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <Link href={`/admin/users/${user.id}`} className="underline-offset-2 hover:underline">
                          {user.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{user.email || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{user.role}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(user.status)}`}>
                          {USER_STATUS_LABEL[user.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{user.recentSanctionCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}

              {!isLoading && failed ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    목록을 불러오지 못했어요.{" "}
                    <button type="button" className="font-semibold underline" onClick={() => mutate()}>
                      다시 시도
                    </button>
                  </td>
                </tr>
              ) : null}
              {!isLoading && !failed && users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    검색 결과가 없어요.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            이전
          </Button>
          <span className="text-xs text-gray-600">
            {page} / {lastPage} (총 {total}명)
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => current + 1)}
          >
            다음
          </Button>
        </div>
      ) : null}
    </div>
  );
}
