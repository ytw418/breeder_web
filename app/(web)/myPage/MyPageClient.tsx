"use client";

import MyPostList from "@components/features/profile/myPostList";
import MySaleHistroyMenu from "@components/features/profile/MySaleHistroyMenu";
import { Button } from "@components/ui/button";
import useUser from "hooks/useUser";
import { useRouter } from "next/navigation";
import useLogout from "../../../hooks/useLogout";
import Image from "@components/atoms/Image";
import useSWR from "swr";
import { UserResponse } from "pages/api/users/[id]";

const MyPageClient = () => {
  const { user } = useUser();
  const router = useRouter();
  const handleLogout = useLogout();

  // _count 포함된 유저 정보 가져오기
  const { data } = useSWR<UserResponse>(
    user?.id ? `/api/users/${user.id}` : null
  );

  const avatarUrl =
    user?.avatar &&
    (user.avatar.includes("http")
      ? user.avatar
      : `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${user.avatar}/avatar`);

  const profileUser = data?.user;

  return (
    <div className="flex flex-col pb-4">
      {/* 프로필 헤더 */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-5">
          {/* 아바타 */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={user?.name || "프로필"}
                width={80}
                height={80}
                className="w-20 h-20 rounded-full bg-gray-200 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* 통계 */}
          <div className="flex-1 flex justify-around">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">
                {profileUser?._count?.products ?? 0}
              </span>
              <span className="text-xs text-gray-500">상품</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">
                {profileUser?._count?.followers ?? 0}
              </span>
              <span className="text-xs text-gray-500">팔로워</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">
                {profileUser?._count?.following ?? 0}
              </span>
              <span className="text-xs text-gray-500">팔로잉</span>
            </div>
          </div>
        </div>

        {/* 이름 + 이메일 */}
        <div className="mt-4">
          <h2 className="text-lg font-bold text-gray-900">
            {user?.name || ""}
          </h2>
          {user?.email && (
            <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/editProfile")}
          >
            프로필 수정
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleLogout}
          >
            로그아웃
          </Button>
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-2 bg-gray-50" />

      {/* 거래 메뉴 */}
      <div className="px-4 py-4">
        <MySaleHistroyMenu />
      </div>

      {/* 구분선 */}
      <div className="h-2 bg-gray-50" />

      {/* 등록 상품 */}
      <div className="px-4 py-4">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          등록한 상품
        </h3>
        <MyPostList userId={user?.id} />
      </div>
    </div>
  );
};

export default MyPageClient;
