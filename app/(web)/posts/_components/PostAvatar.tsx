"use client";

import Image from "@components/atoms/Image";
import {
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

/**
 * 앱 BreederProgramAvatar: 원형 아바타(없으면 app-placeholder 빈 원).
 * 브리더 프로그램이 있으면 2px 그라데이션 프레임 + 안쪽 app-bg 링.
 */
export function PostAvatar({
  user,
  size,
}: {
  user?: { avatar?: string | null; breederPrograms?: BreederProgramSummary[] | null } | null;
  size: number;
}) {
  const image = user?.avatar ? (
    <Image
      src={makeImageUrl(user.avatar, "avatar")}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="block rounded-full bg-app-placeholder" style={{ width: size, height: size }} />
  );

  if (!hasBreederProgramFrame(user?.breederPrograms)) return image;

  return (
    <span
      className={cn(
        "inline-block rounded-full p-0.5",
        getBreederProgramFrameClassName(user?.breederPrograms)
      )}
    >
      <span className="block rounded-full bg-app-bg">{image}</span>
    </span>
  );
}

export default PostAvatar;
