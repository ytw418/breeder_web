"use client";

import useSWR from "swr";
import { toast } from "react-toastify";
import { Button } from "@components/ui/button";

const ROLE_OPTIONS = ["USER", "ADMIN", "SUPER_USER"] as const;

export default function AdminUsersPage() {
  const { data, mutate } = useSWR("/api/admin/users");

  const handleRoleChange = async (userId: number, role: string) => {
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
    if (!confirm("정말로 이 유저를 삭제하시겠습니까?")) return;

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">유저 관리</h2>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
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
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  유저가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

