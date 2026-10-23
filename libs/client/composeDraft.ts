"use client";

/**
 * 글쓰기·분양 등록 임시저장(2026-10-21, 앱 docs/prd/post-upload.md S-1.임시저장 · 앱 src/lib/composeDraft.ts 와 같은 구조).
 * - localStorage `bredy:draft:<kind>:<userId>`. 새 글(create)만 저장한다.
 * - 등록 성공·'새로 쓰기'·로그아웃(hooks/useLogout) 때 지운다. 저장 중 401 이면 임시저장한 뒤 로그인으로 보낸다.
 * - 새로 고른 파일 사진은 저장하지 않는다(본문 자리 표시도 빼고 저장). 이미 올라간 사진 id 만 남긴다.
 */
import { useCallback, useEffect, useRef } from "react";
import type { DealType } from "@libs/shared/categories";
import type { PedigreeNote } from "@libs/shared/pedigree-note";
import type { PetInfo } from "@libs/shared/petSpace";

export type ComposeDraftKind = "post" | "product";

export type PostDraft = {
  savedAt: string;
  title: string;
  category: string;
  species: string;
  /** 본문(파일 사진 자리 표시를 뺀 저장 형식). [[photo:N]] 은 remoteImageIds[N-1]. */
  description: string;
  remoteImageIds: string[];
};

export type ProductDraft = {
  savedAt: string;
  name: string;
  /** 가격(null = 미입력, 0 = 무료 분양). 앱은 숫자 문자열로 둔다. */
  price: number | null;
  /** 하위 분류가 있으면 하위 분류, 없으면 대분류. */
  category: string;
  productType: string;
  /** DealType("sale" 등). 폼 상태가 string 이라 넓게 둔다. */
  dealType: DealType | string;
  description: string;
  bloodlineRootId: number | null;
  pedigreeNote: PedigreeNote | null;
  /** 웹 붙이기 행이 보여 줄 혈통 이름(앱엔 없다 — 앱은 목록에서 다시 찾는다). */
  bloodlineName?: string | null;
  /** 강아지·고양이 글 정보(docs/prd/pet-space.md §5.5). 옛 임시저장엔 없다. */
  petInfo?: PetInfo | null;
};

type DraftOf<K extends ComposeDraftKind> = K extends "post" ? PostDraft : ProductDraft;
export type ComposeDraftInput<K extends ComposeDraftKind> = Omit<DraftOf<K>, "savedAt">;

const KEY_PREFIX = "bredy:draft:";
const AUTOSAVE_DELAY_MS = 1000;

export const composeDraftKey = (kind: ComposeDraftKind, userId: number) => `${KEY_PREFIX}${kind}:${userId}`;

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readComposeDraft<K extends ComposeDraftKind>(kind: K, userId: number): DraftOf<K> | null {
  try {
    const raw = getStorage()?.getItem(composeDraftKey(kind, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftOf<K> | null;
    return parsed && typeof parsed.savedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeComposeDraft<K extends ComposeDraftKind>(
  kind: K,
  userId: number,
  draft: ComposeDraftInput<K>
): void {
  try {
    getStorage()?.setItem(
      composeDraftKey(kind, userId),
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    );
  } catch {
    // 저장 공간이 꽉 찼거나 막혀 있어도 글쓰기는 계속한다.
  }
}

export function deleteComposeDraft(kind: ComposeDraftKind, userId: number): void {
  try {
    getStorage()?.removeItem(composeDraftKey(kind, userId));
  } catch {
    // noop
  }
}

/** 로그아웃 때: 이 브라우저의 모든 계정 임시저장을 지운다. */
export function clearComposeDrafts(storage: Storage | null = getStorage()): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // noop
  }
}

/** 시트 보조 줄 앞부분: 제목 앞 20자(비면 '제목 없음'). 앱과 같다. */
export function composeDraftLabel(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "제목 없음";
  return trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed;
}

/**
 * 1초 디바운스 자동 저장(앱과 같다). draft 가 null 이면 지운다. enabled 가 false 면 저장하지 않는다.
 * 탭을 숨기거나 화면을 떠날 때 기다리던 저장을 바로 쓴다. 반환한 save() 는 지금 값을 바로 저장하고(401 로 로그인 이동 전),
 * stop() 은 이후 저장을 막는다(등록 성공 직후).
 */
export function useComposeDraftAutosave<K extends ComposeDraftKind>(
  kind: K,
  userId: number | null | undefined,
  draft: ComposeDraftInput<K> | null,
  enabled: boolean
): { save: () => void; stop: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const serialized = draft ? JSON.stringify(draft) : null;
  const latestRef = useRef({ serialized, userId });

  useEffect(() => {
    latestRef.current = { serialized, userId };
  });

  const writeLatest = useCallback(() => {
    const latest = latestRef.current;
    if (stoppedRef.current || latest.userId == null) return;
    if (latest.serialized) {
      writeComposeDraft(kind, latest.userId, JSON.parse(latest.serialized) as ComposeDraftInput<K>);
    } else {
      deleteComposeDraft(kind, latest.userId);
    }
  }, [kind]);

  const flush = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    writeLatest();
  }, [writeLatest]);

  // 아래 디바운스 effect 보다 먼저 선언해, 화면을 떠날 때 타이머가 지워지기 전에 쓴다.
  useEffect(() => flush, [flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  useEffect(() => {
    if (!enabled || userId == null || stoppedRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      writeLatest();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [userId, serialized, enabled, writeLatest]);

  const save = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    writeLatest();
  }, [writeLatest]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  return { save, stop };
}
