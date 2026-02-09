"use client";

import Link from "next/link";

const DASHBOARD_MENUS = [
  {
    title: "배너 관리",
    description: "메인 상단 배너를 생성/삭제합니다.",
    href: "/admin/banners",
  },
  {
    title: "유저 관리",
    description: "유저 목록 확인, 권한 변경, 삭제를 수행합니다.",
    href: "/admin/users",
  },
  {
    title: "게시물 관리",
    description: "게시글 검색, 확인, 삭제를 수행합니다.",
    href: "/admin/posts",
  },
  {
    title: "상품 관리",
    description: "상품 검색, 확인, 삭제를 수행합니다.",
    href: "/admin/products",
  },
];

export default function AdminDashboardPage() {

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">어드민 대시보드</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DASHBOARD_MENUS.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <p className="text-lg font-semibold text-gray-900">{menu.title}</p>
            <p className="mt-2 text-sm text-gray-500">{menu.description}</p>
            <p className="mt-4 text-sm font-semibold text-primary">바로가기</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
