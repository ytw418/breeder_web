import { makeImageUrl } from "@libs/client/utils";
import { cn } from "@libs/client/utils";
import Image from "@components/atoms/Image";
import { MessageType } from "@prisma/client";
import Link from "next/link";

interface MessageProps {
  message: string;
  reversed?: boolean;
  avatarUrl?: string | null;
  type?: MessageType;
  image?: string | null;
  userId?: number; // 프로필 이동을 위한 유저 ID
}

export default function Message({
  message,
  avatarUrl,
  reversed,
  type = "TEXT",
  image,
  userId,
}: MessageProps) {
  const avatarElement = (
    <Image
      alt="프로필 이미지"
      width={30}
      height={30}
      src={makeImageUrl(avatarUrl, "public")}
      className="w-[30px] h-[30px] rounded-full bg-slate-300 flex-shrink-0"
    />
  );

  return (
    <div
      className={cn(
        "flex items-start",
        reversed ? "flex-row-reverse space-x-reverse" : "space-x-2"
      )}
    >
      {!reversed &&
        (userId ? (
          <Link href={`/profiles/${userId}`} className="flex-shrink-0">
            {avatarElement}
          </Link>
        ) : (
          avatarElement
        ))}

      {type === "IMAGE" && image ? (
        <div className="max-w-[70%] rounded-lg overflow-hidden">
          <Image
            src={makeImageUrl(image, "public")}
            alt="채팅 이미지"
            width={280}
            height={280}
            className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        </div>
      ) : (
        <div className="max-w-[80%] text-sm text-gray-700 p-2 border border-gray-300 rounded-md">
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}
