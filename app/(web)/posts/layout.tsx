"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useUser from "hooks/useUser";
import { useEffect } from "react";
import { cn } from "@libs/client/utils";

const ADMIN_MENUS = [
  { name: "대시보드", href: "/admin" },
  { name: "배너 관리", href: "/admin/banners" },
  { name: "유저 관리", href: "/admin/users" },
  { name: "게시물 관리", href: "/admin/posts" }, // 추후 구현
  { name: "상품 관리", href: "/admin/products" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "ADMIN")) {
      // router.replace("/"); // 실제 적용 시 주석 해제
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="p-10">Loading Admin...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 사이드바 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Breeder Admin</h1>
        </div>
        <nav className="p-4 space-y-1">
          {ADMIN_MENUS.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
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
            className="flex items-center px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg mt-10"
          >
            ← 사이트로 돌아가기
          </Link>
        </nav>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}