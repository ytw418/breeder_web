import { makeImageUrl } from "@libs/client/utils";
import clsx from "clsx";
import Image from "next/image";

interface MessageProps {
  message: string;
  reversed?: boolean;
  avatarUrl?: string | null;
}

export default function Message({
  message,
  avatarUrl,
  reversed,
}: MessageProps) {
  return (
    <div
      className={clsx(
        "flex items-center",
        reversed ? "flex-row-reverse space-x-reverse" : "space-x-2"
      )}
    >
      {!reversed && (
        <Image
          alt={`프로필 이미지`}
          width={20}
          height={20}
          src={makeImageUrl(avatarUrl, "public")}
          className="w-[30px] h-[30px] rounded-full bg-slate-300"
        />
      )}

      <div className="max-w-[80%] text-sm text-gray-700 p-2 border border-gray-300 rounded-md">
        <p>{message}</p>
      </div>
    </div>
  );
}
