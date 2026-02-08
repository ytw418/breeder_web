"use client";

import Layout from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";
import useLogout from "hooks/useLogout";
import Link from "next/link";

interface SettingItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  description?: string;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

const ChevronRight = () => (
  <svg
    className="w-4 h-4 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const SettingsClient = () => {
  const { user } = useUser();
  const handleLogout = useLogout();

  const sections: SettingSection[] = [
    {
      title: "계정",
      items: [
        {
          label: "프로필 수정",
          href: "/editProfile",
          description: "이름, 프로필 사진 변경",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          ),
        },
        {
          label: "내 상품 관리",
          href: user?.id ? `/profiles/${user.id}/sales` : "/myPage",
          description: "판매/구매 내역 확인",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          ),
        },
      ],
    },
    {
      title: "알림",
      items: [
        {
          label: "알림 설정",
          href: "/notifications",
          description: "알림 확인",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          ),
        },
      ],
    },
    {
      title: "서비스 정보",
      items: [
        {
          label: "이용약관",
          href: "#",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          ),
        },
        {
          label: "개인정보 처리방침",
          href: "#",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          ),
        },
        {
          label: "앱 버전",
          description: "1.0.0",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ),
        },
      ],
    },
    {
      title: "",
      items: [
        {
          label: "로그아웃",
          onClick: handleLogout,
          danger: true,
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          ),
        },
      ],
    },
  ];

  return (
    <Layout canGoBack title="설정" seoTitle="설정">
      <div className="pb-10">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            {section.title && (
              <div className="px-4 pt-6 pb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
            )}
            <div>
              {section.items.map((item, itemIdx) => {
                const content = (
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50",
                      item.danger && "hover:bg-red-50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                        item.danger
                          ? "bg-red-50 text-red-500"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {item.icon}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          item.danger ? "text-red-500" : "text-gray-900"
                        )}
                      >
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {item.href && <ChevronRight />}
                  </div>
                );

                if (item.href) {
                  return (
                    <Link key={itemIdx} href={item.href}>
                      {content}
                    </Link>
                  );
                }

                if (item.onClick) {
                  return (
                    <button
                      key={itemIdx}
                      onClick={item.onClick}
                      className="w-full text-left"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <div key={itemIdx}>{content}</div>
                );
              })}
            </div>
            {sectionIdx < sections.length - 1 && (
              <div className="h-2 bg-gray-50 mt-1" />
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default SettingsClient;
