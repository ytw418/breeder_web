"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useUser from "hooks/useUser";
import { useEffect } from "react";
import { cn } from "@libs/client/utils";

const ADMIN_MENUS = [
  { name: "대시보드", href: "/admin" },
  { name: "경매 관리", href: "/admin/auctions" },
  { name: "배너 관리", href: "/admin/banners" },
  { name: "랜딩 페이지", href: "/admin/landing-pages" },
  { name: "기네스북 심사", href: "/admin/guinness" },
  { name: "유저 관리", href: "/admin/users" },
  { name: "게시물 관리", href: "/admin/posts" }, // 추후 구현
  { name: "상품 관리", href: "/admin/products" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAdmin } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const isAdminLoginPage = pathname === "/admin/login";
  const hasAccess = Boolean(user && isAdmin);

  useEffect(() => {
    if (isAdminLoginPage) {
      return;
    }

    if (!isLoading && !hasAccess) {
      const nextPath = pathname || "/admin";
      router.replace(`/admin/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [hasAccess, isAdminLoginPage, isLoading, pathname, router]);

  if (isAdminLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) return <div className="p-10">Loading Admin...</div>;
  if (!hasAccess) return <div className="p-10 text-gray-500">권한 확인 중...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 모바일 상단 네비 */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-base font-bold text-gray-900">Bredy Admin</h1>
          <Link
            href="/"
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            사이트로
          </Link>
        </div>
        <nav className="overflow-x-auto px-4 pb-3 scrollbar-hide">
          <div className="flex gap-2">
            {ADMIN_MENUS.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors",
                  pathname === menu.href
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {menu.name}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <div className="md:flex">
        {/* 데스크톱 사이드바 */}
        <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
          <div className="flex h-16 items-center border-b border-gray-200 px-6">
            <h1 className="text-xl font-bold text-gray-900">Bredy Admin</h1>
          </div>
          <nav className="space-y-1 p-4">
            {ADMIN_MENUS.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className={cn(
                  "flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  pathname === menu.href
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {menu.name}
              </Link>
            ))}
            <Link
              href="/"
              className="mt-10 flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              ← 사이트로 돌아가기
            </Link>
          </nav>
        </aside>

        {/* 메인 컨텐츠 */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
