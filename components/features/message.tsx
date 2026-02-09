import { makeImageUrl } from "@libs/client/utils";
import { cn } from "@libs/client/utils";
import Image from "@components/atoms/Image";
import { MessageType } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import NextImage from "next/image";
import { format } from "date-fns";

interface MessageProps {
  message: string;
  reversed?: boolean;
  avatarUrl?: string | null;
  type?: MessageType;
  image?: string | null;
  userId?: number;
  createdAt?: string;
  showAvatar?: boolean;
  showTime?: boolean;
}

export default function Message({
  message,
  avatarUrl,
  reversed,
  type = "TEXT",
  image,
  userId,
  createdAt,
  showAvatar = true,
  showTime = true,
}: MessageProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const imageSrc = image ? makeImageUrl(image, "public") : "";

  useEffect(() => {
    setImageLoadFailed(false);
  }, [image]);

  useEffect(() => {
    if (!viewerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewerOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [viewerOpen]);

  const avatarElement = showAvatar ? (
    <Image
      alt="프로필 이미지"
      width={30}
      height={30}
      src={makeImageUrl(avatarUrl, "avatar")}
      className="h-[30px] w-[30px] rounded-full bg-slate-200 ring-1 ring-slate-200"
    />
  ) : (
    <div className="h-[30px] w-[30px]" />
  );

  const timeLabel = createdAt ? format(new Date(createdAt), "HH:mm") : "";

  return (
    <>
      <div className={cn("flex w-full", reversed ? "justify-end" : "justify-start")}>
        {!reversed &&
          (userId ? (
            <Link href={`/profiles/${userId}`} className="mr-2 flex-shrink-0">
              {avatarElement}
            </Link>
          ) : (
            <div className="mr-2 flex-shrink-0">{avatarElement}</div>
          ))}

        <div
          className={cn(
            "flex max-w-[78%] flex-col",
            reversed ? "items-end" : "items-start"
          )}
        >
          {type === "IMAGE" && image ? (
            <button
              type="button"
              className="overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
              onClick={() => setViewerOpen(true)}
              aria-label="채팅 이미지 크게 보기"
            >
              {imageLoadFailed ? (
                <div className="flex h-[180px] w-[240px] items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
                  이미지를 불러오지 못했습니다
                </div>
              ) : (
                <NextImage
                  src={imageSrc}
                  alt="채팅 이미지"
                  width={240}
                  height={240}
                  className="max-h-[320px] w-auto object-cover transition-opacity hover:opacity-95"
                  onError={() => setImageLoadFailed(true)}
                />
              )}
            </button>
          ) : (
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                reversed
                  ? "rounded-br-md bg-slate-900 text-white"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
              )}
            >
              <p className="break-words whitespace-pre-wrap">{message}</p>
            </div>
          )}

          {showTime && timeLabel && (
            <span className="mt-1 px-1 text-[11px] text-slate-400">{timeLabel}</span>
          )}
        </div>
      </div>

      {viewerOpen && type === "IMAGE" && image && !imageLoadFailed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4"
          onClick={() => setViewerOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-[72vh] w-full overflow-hidden rounded-2xl bg-black">
              <NextImage
                src={imageSrc}
                alt="채팅 이미지 전체보기"
                fill
                className="object-contain"
                onError={() => setImageLoadFailed(true)}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <a
                href={imageSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-white/15 px-3 py-2 text-xs font-medium text-white hover:bg-white/25"
              >
                새 탭으로 보기
              </a>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="rounded-md bg-white/15 px-3 py-2 text-xs font-medium text-white hover:bg-white/25"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
