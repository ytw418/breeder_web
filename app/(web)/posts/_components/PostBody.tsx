"use client";

import { useState } from "react";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";
import { parsePostBody, splitLinks } from "@libs/shared/post-body";

/**
 * 받기 전엔 비율을 몰라 4:3 자리로 그리고, 받은 비율은 기억해 다시 열 때 높이가 튀지 않게 한다.
 * 아주 긴 세로 사진은 1:2 로 잘라 보인다. 앱 src/components/features/post/PostBodyImage.tsx 와 같은 규칙.
 */
const ratioCache = new Map<string, number>();
const DEFAULT_RATIO = 4 / 3;
const MIN_RATIO = 0.5;

function PostBodyPhoto({ src, alt }: { src: string; alt: string }) {
  const [ratio, setRatio] = useState<number | null>(() => ratioCache.get(src) ?? null);
  return (
    <span
      className="relative block w-full"
      style={{ aspectRatio: String(Math.max(MIN_RATIO, ratio ?? DEFAULT_RATIO)) }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 640px"
        className="object-cover"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (!naturalWidth || !naturalHeight) return;
          const next = naturalWidth / naturalHeight;
          ratioCache.set(src, next);
          setRatio(next);
        }}
      />
    </span>
  );
}

/**
 * 게시글 본문 — 줄(보통 16 · 크게 20 · 굵게)과 사진을 쓴 자리 그대로 위에서 아래로 그린다.
 * 앱 src/components/features/post/PostBody.tsx 와 같은 구성(앱 docs/prd/post-upload.md S-3·S-4).
 * 자리 표시가 없는 사진(옛 글)은 parsePostBody 가 본문 뒤에 붙여 준다.
 */
export function PostBody({
  description,
  images,
  onOpenImage,
}: {
  description: string;
  images: readonly string[];
  /** images 안의 위치로 라이트박스를 연다. */
  onOpenImage: (imageIndex: number) => void;
}) {
  const blocks = parsePostBody(description, images);

  return (
    <div className="flex flex-col">
      {blocks.map((block, index) =>
        block.type === "image" ? (
          <button
            key={`image-${block.imageIndex}`}
            type="button"
            aria-label={`게시글 이미지 ${block.imageIndex + 1} 크게 보기`}
            onClick={() => onOpenImage(block.imageIndex)}
            className="my-3 block w-full overflow-hidden rounded-lg bg-app-placeholder"
          >
            <PostBodyPhoto
              src={makeImageUrl(block.image, "public")}
              alt={`게시글 이미지 ${block.imageIndex + 1}`}
            />
          </button>
        ) : (
          <p
            key={`text-${index}`}
            className={cn(
              "whitespace-pre-wrap break-words text-app-text",
              block.size === "large" ? "text-[20px] leading-[30px]" : "text-[16px] leading-6",
              block.bold && "font-bold"
            )}
          >
            {block.text
              ? splitLinks(block.text).map((part, partIndex) =>
                  part.type === "link" ? (
                    <a
                      key={partIndex}
                      href={part.value}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="break-all text-app-info"
                    >
                      {part.value}
                    </a>
                  ) : (
                    <span key={partIndex}>{part.value}</span>
                  )
                )
              : " "}
          </p>
        )
      )}
    </div>
  );
}
