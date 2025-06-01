import Image from "@components/atoms/Image";
import React from "react";
import { User } from "@prisma/client";
const Profile = ({
  user,
  imageClassName,
}: {
  user?: User;
  imageClassName?: string;
}) => {
  return (
    <div className="Profile flex flex-row justify-between items-center mt-4">
      <div className="flex items-center space-x-3">
        {user?.avatar ? (
          <Image
            src={
              user.avatar.includes("http")
                ? user.avatar
                : `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${user.avatar}/avatar`
            }
            width={64}
            height={64}
            className="w-16 h-16 bg-slate-500 rounded-full"
            alt="프로필 이미지"
          />
        ) : (
          <div className="w-16 h-16 bg-slate-500 rounded-full" />
        )}
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{user?.name}</span>
          <span className="body-1 text-Gray-500">{user?.email}</span>
        </div>
      </div>
    </div>
  );
};

export default Profile;
