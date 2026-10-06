"use client";

import { toast } from "@libs/client/toast";

/** 공유 결과: 공유 시트 완료 / 링크 복사 / 실패(취소 포함은 "failed" 아님 — 아래 참고). */
export type ShareResult = "shared" | "copied" | "failed";

const FALLBACK_ORIGIN = "https://bredy.app";

/** "/products/1" → "https://bredy.app/products/1" (현재 origin 기준). 이미 절대 URL 이면 그대로. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : FALLBACK_ORIGIN;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 클립보드 복사. 성공하면 true. navigator.clipboard 가 없으면 textarea 복사로 대신한다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 권한 거부 등은 아래 대체 경로로 시도한다.
  }
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    document.body.removeChild(textarea);
    return Boolean(ok);
  } catch {
    return false;
  }
}

const isAbortError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "AbortError";

/**
 * 공유 시트(Web Share API)가 있으면 띄우고, 없으면 링크를 복사한다.
 * - 사용자가 공유 시트를 닫으면(AbortError) 조용히 "failed" 를 돌려준다(토스트 없음).
 * - 복사 성공 시 토스트 "링크를 복사했어요".
 */
export async function shareOrCopy({
  title,
  text,
  url,
}: {
  title: string;
  text?: string;
  url: string;
}): Promise<ShareResult> {
  const fullUrl = absoluteUrl(url);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url: fullUrl });
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "failed";
      // 그 밖의 공유 실패는 링크 복사로 넘어간다.
    }
  }
  const copied = await copyText(fullUrl);
  if (copied) {
    toast.success("링크를 복사했어요");
    return "copied";
  }
  toast.error("링크를 복사하지 못했어요");
  return "failed";
}
