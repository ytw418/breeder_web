"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@components/ui/button";

type TestAccountItem = {
  id: number;
  name: string;
  email: string | null;
  provider: string;
  createdAt: string;
};

type TestAccountListResponse = {
  success: boolean;
  error?: string;
  users?: TestAccountItem[];
};

type TestAccountSwitchResponse = {
  success: boolean;
  error?: string;
};

const FakePageClient = () => {
  const router = useRouter();
  const [testUsers, setTestUsers] = useState<TestAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [switchingUserId, setSwitchingUserId] = useState<number | null>(null);
  const [createUserCount, setCreateUserCount] = useState("3");
  const [createError, setCreateError] = useState("");
  const [isCreatingUsers, setIsCreatingUsers] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/users/test-accounts", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json()) as TestAccountListResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "테스트 계정 목록 조회에 실패했습니다.");
      }
      setTestUsers(data.users || []);
    } catch (e) {
      setTestUsers([]);
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreateTestUsers = async () => {
    setCreateError("");
    const count = Math.min(Math.max(Number(createUserCount || "1"), 1), 20);
    if (!count || Number.isNaN(count)) {
      setCreateError("생성 개수를 1~20 사이 숫자로 입력해주세요.");
      return;
    }

    setIsCreatingUsers(true);
    try {
      const res = await fetch("/api/users/test-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          count,
          namePrefix: "fake",
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || "테스트 계정 생성에 실패했습니다.");
      }

      await loadUsers();
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "테스트 계정 생성 중 오류가 발생했습니다."
      );
    } finally {
      setIsCreatingUsers(false);
    }
  };

  const handleSwitchUser = async (targetUserId: number) => {
    if (switchingUserId === targetUserId) return;

    setError("");
    setSwitchingUserId(targetUserId);

    try {
      const res = await fetch("/api/users/test-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = (await res.json()) as TestAccountSwitchResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "해당 계정으로 전환하지 못했습니다.");
      }

      router.push("/myPage");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "테스트 계정 전환 중 오류가 발생했습니다."
      );
      setSwitchingUserId(null);
    } finally {
      setSwitchingUserId(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-8 pt-6">
      <h1 className="text-xl font-bold text-slate-900">FAKE_USER 목록</h1>
      <p className="mt-1 text-sm text-slate-500">
        아래 계정으로 전환해 실제 사용자처럼 활동을 시뮬레이션할 수 있습니다.
      </p>

      {isLoading ? <p className="mt-4 text-sm text-slate-500">목록을 불러오는 중...</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}
      {!isLoading && !testUsers.length ? (
        <p className="mt-4 text-sm text-slate-500">활성 FAKE_USER가 없습니다.</p>
      ) : null}

      <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">테스트 계정 추가</p>
        <p className="mt-1 text-xs text-slate-500">항상 생성 가능: 최소 1개, 최대 20개까지 만들 수 있습니다.</p>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min={1}
            max={20}
            value={createUserCount}
            onChange={(e) => setCreateUserCount(e.target.value)}
            className="h-10 w-20 rounded-md border border-slate-300 px-2 text-sm outline-none"
          />
          <Button
            type="button"
            variant="outline"
            className="px-3"
            onClick={handleCreateTestUsers}
            disabled={isCreatingUsers}
          >
            {isCreatingUsers ? "생성 중..." : "fake 계정 생성"}
          </Button>
        </div>
        {createError ? <p className="mt-2 text-xs text-rose-500">{createError}</p> : null}
      </section>

      <div className="mt-4 space-y-2">
        {testUsers.map((account) => (
          <button
            key={account.id}
            type="button"
            disabled={switchingUserId === account.id}
            onClick={() => handleSwitchUser(account.id)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 disabled:opacity-50"
          >
            <div className="font-medium text-slate-900">{account.name}</div>
            <div className="text-xs text-slate-500">
              {switchingUserId === account.id ? "전환 중..." : account.provider}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.push("/myPage")}
        >
          마이페이지로 이동
        </Button>
      </div>
    </div>
  );
};

export default FakePageClient;
