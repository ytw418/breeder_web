"use client";

import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";
import { avatarInitial, avatarToneClass } from "./avatarTone";

/**
 * 사진이 있으면 사진, 없으면 이름 해시 파스텔 톤 + 이니셜(community-vibe §3.7).
 * size 는 px. 글자 크기는 지름의 0.36 배.
 */
export function InitialAvatar({
  name,
  avatar,
  size,
  className,
}: {
  name: string | null | undefined;
  avatar?: string | null;
  size: number;
  className?: string;
}) {
  if (avatar) {
    return (
      <Image
        src={makeImageUrl(avatar, "avatar")}
        width={size}
        height={size}
        alt={name ? `${name} 프로필 사진` : "프로필 사진"}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        avatarToneClass(name),
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
    >
      {avatarInitial(name)}
    </span>
  );
}

export default InitialAvatar;
