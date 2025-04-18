import { useRouter } from "next/router";
import Link from "next/link";
import useSWR from "swr";
import { cls } from "@libs/client/utils";

interface LayoutProps {
  title?: string;
  canGoBack?: boolean;
  hasTabBar?: boolean;
  children: React.ReactNode;
}

interface UnreadCountResponse {
  success: boolean;
  unreadCount: number;
}

export default function Layout({
  title,
  canGoBack,
  hasTabBar,
  children,
}: LayoutProps) {
  const router = useRouter();
  const { data: unreadData } = useSWR<UnreadCountResponse>(
    "/api/chat/unread-count"
  );

  const onClick = () => {
    router.back();
  };

  return (
    <div>
      <div
        className={cls(
          !canGoBack ? "justify-center" : "",
          "bg-white w-full max-w-xl text-lg px-5 font-medium py-3 fixed text-gray-800 border-b top-0 flex items-center"
        )}
      >
        {canGoBack ? (
          <button onClick={onClick} className="absolute left-4">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        ) : null}
        {title ? <span>{title}</span> : null}
      </div>
      <div className={cls("pt-16", hasTabBar ? "pb-16" : "")}>{children}</div>
      {hasTabBar ? (
        <nav className="bg-white max-w-xl text-gray-700 border-t fixed bottom-0 w-full px-10 pb-5 pt-3 flex justify-between text-xs">
          <Link
            href="/"
            className={cls(
              "flex flex-col items-center space-y-2",
              router.pathname === "/"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
            )}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span>홈</span>
          </Link>
          <Link
            href="/community"
            className={cls(
              "flex flex-col items-center space-y-2",
              router.pathname === "/community"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
            )}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            <span>동네생활</span>
          </Link>
          <Link
            href="/chats"
            className={cls(
              "flex flex-col items-center space-y-2 relative",
              router.pathname === "/chats"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
            )}
          >
            {unreadData?.success && unreadData.unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {unreadData.unreadCount}
              </span>
            ) : null}
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>채팅</span>
          </Link>
          <Link
            href="/streams"
            className={cls(
              "flex flex-col items-center space-y-2",
              router.pathname === "/streams"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
            )}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>라이브</span>
          </Link>
          <Link
            href="/profile"
            className={cls(
              "flex flex-col items-center space-y-2",
              router.pathname === "/profile"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
            )}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>프로필</span>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
