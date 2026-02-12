"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useUser from "hooks/useUser";
import useLogout from "hooks/useLogout";
import { Button } from "@components/ui/button";

const getSafeAdminPath = (rawPath: string | null) => {
  if (!rawPath) return "/admin";
  let normalized = rawPath.trim();

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // noop
  }

  if (!normalized.startsWith("/admin") || normalized.startsWith("//")) {
    return "/admin";
  }

  return normalized;
};

export default function AdminLoginPage() {
  const { user, isLoading, isAdmin } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logout = useLogout();

  const nextPath = useMemo(
    () => getSafeAdminPath(searchParams?.get("next") ?? null),
    [searchParams]
  );

  const hasAccess = Boolean(user && isAdmin);

  useEffect(() => {
    if (!isLoading && hasAccess) {
      router.replace(nextPath);
    }
  }, [hasAccess, isLoading, nextPath, router]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">어드민 로그인</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          어드민 페이지는 관리자 권한 계정만 접근할 수 있습니다.
          로그인 후 권한이 확인되면 어드민 화면으로 이동합니다.
        </p>

        <div className="mt-5 space-y-3">
          {user && !hasAccess ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              현재 로그인된 계정은 관리자 권한이 없습니다.
            </div>
          ) : null}

          <Link
            href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#fee500] text-sm font-bold text-[#191919] hover:brightness-95"
          >
            카카오로 어드민 로그인
          </Link>

          {user && !hasAccess ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              onClick={logout}
            >
              현재 계정 로그아웃
            </Button>
          ) : null}

          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
