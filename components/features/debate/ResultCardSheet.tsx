"use client";

import { useState } from "react";

import { BottomSheet } from "@components/app/BottomSheet";
import { shareOrCopy } from "@libs/client/share";
import { toast } from "@libs/client/toast";
import { toPostPath } from "@libs/post-route";

/** 결과 카드 이미지 주소(서버 app/api/og/debate/[id], 1080×1350). */
export const resultCardImageUrl = (postId: number) => `/api/og/debate/${postId}`;

/**
 * 상시 토론 결과 카드 시트(앱 docs/prd/evergreen-debate.md S-5, 시안 ④).
 * 미리보기 + '이미지 저장'(내려받기) · '공유하기'(이미지 공유가 되면 이미지, 아니면 글 링크).
 * 앱 src/components/features/debate/ResultCardSheet.tsx 와 같은 문구.
 */
export default function ResultCardSheet({
  open,
  onClose,
  postId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  postId: number;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const src = resultCardImageUrl(postId);
  const fileName = `bredy-debate-${postId}.png`;

  const loadFile = async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error("card");
    return new File([await res.blob()], fileName, { type: "image/png" });
  };

  const save = async () => {
    setBusy(true);
    try {
      const file = await loadFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("이미지를 저장하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const file = await loadFile().catch(() => null);
      if (file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title }).catch(() => undefined);
        return;
      }
      await shareOrCopy({ title, url: toPostPath(postId, title) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="결과 카드" ariaLabel="결과 카드">
      <div className="px-4 pb-6">
        <p className="text-[14px] leading-5 text-app-muted">지금까지 쌓인 결과로 만들어요. 닉네임은 들어가지 않아요.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 그린 PNG 를 그대로 보여 준다 */}
        <img
          src={src}
          alt={`${title} 결과 카드`}
          width={1080}
          height={1350}
          className="mx-auto mt-4 aspect-[4/5] w-[70%] max-w-[300px] rounded-xl bg-app-surface"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="h-11 flex-1 rounded-lg bg-app-surface text-[15px] font-semibold text-app-text"
          >
            이미지 저장
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void share()}
            className="h-11 flex-1 rounded-lg bg-app-brand text-[15px] font-semibold text-white"
          >
            공유하기
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
