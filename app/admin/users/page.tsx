"use client";

import useSWR from "swr";
import { toast } from "react-toastify";
import { Button } from "@components/ui/button";
import useConfirmDialog from "hooks/useConfirmDialog";

const ROLE_OPTIONS = ["USER", "ADMIN", "SUPER_USER"] as const;
const STATUS_OPTIONS = [
  "ACTIVE",
  "BANNED",
  "SUSPENDED_7D",
  "SUSPENDED_30D",
  "DELETED",
] as const;

export default function AdminUsersPage() {
  const { data, mutate } = useSWR("/api/admin/users");
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleRoleChange = async (userId: number, role: string) => {
    const confirmed = await confirm({
      title: "권한을 변경할까요?",
      description: "권한 변경은 즉시 반영됩니다.",
      confirmText: "변경",
    });
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "update_role", role }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "권한 변경 실패");
      }
      toast.success("권한이 변경되었습니다.");
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  const handleDelete = async (userId: number) => {
    const confirmed = await confirm({
      title: "이 유저를 삭제할까요?",
      description: "삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "delete" }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "삭제 실패");
      }
      toast.success("유저가 삭제되었습니다.");
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  const handleStatusChange = async (userId: number, status: string) => {
    const confirmed = await confirm({
      title: "계정 상태를 변경할까요?",
      description: "상태 변경은 즉시 반영됩니다.",
      confirmText: "변경",
      tone: status === "BANNED" ? "danger" : "default",
    });
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "update_status", status }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "상태 변경 실패");
      }
      toast.success("계정 상태가 변경되었습니다.");
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    }
  };

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">유저 관리</h2>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[820px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  권한
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  가입일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.users?.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email || "-"}</td>
                  <td className="px-6 py-4 text-sm">
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <select
                      value={user.status}
                      onChange={(event) =>
                        handleStatusChange(user.id, event.target.value)
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user.id)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}

              {data?.users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    유저가 없습니다.
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
