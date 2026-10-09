"use client";
/**
 * 관심 카테고리 고정의 루트 동기화(앱 CategoryScopeSync). 화면 코드엔 범위 적용만 남기고 여기서
 * ① localStorage 복원 ② 카테고리 목록과 고정 항목 맞추기(숨긴 카테고리 → 빼고 안내)
 * ③ 서버(/api/users/me) 고정 목록과 브라우저 고정 목록 동기화를 한다.
 * 온보딩 이동은 하지 않는다 — 웹은 로그인 직후에만 띄운다(libs/client/postLogin.ts, 대응표 O-1).
 */
import { useEffect, useRef } from "react";
import useSWR from "swr";
import useUser from "hooks/useUser";
import { CATEGORIES_KEY } from "hooks/useCategoryScope";
import { authFetch } from "@libs/client/authFetch";
import {
  adoptServerPins,
  markCategoryOnboardingDone,
  planInitialScopeSync,
  planOnboardedSync,
  reconcilePinsWithCategories,
  restoreCategoryScope,
  useCategoryScopeState,
} from "@libs/client/categoryScope";
import { toast } from "@libs/client/toast";
import type { CategoriesResponse } from "@libs/shared/categories";

async function postMe(body: Record<string, unknown>) {
  const res = await authFetch("/api/users/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!res.ok || !data?.success) throw new Error("pinned categories sync failed");
}

export default function CategoryScopeSync() {
  const { pins, onboarded, hydrated } = useCategoryScopeState();
  const { user } = useUser();
  const userId = user?.id;
  const serverIds = (user as { pinnedCategoryIds?: number[] } | undefined)?.pinnedCategoryIds;
  const serverOnboardedAt = (user as { categoryOnboardedAt?: string | Date | null } | undefined)
    ?.categoryOnboardedAt;

  // ① 첫 클라이언트 렌더 뒤 복원한다(서버 렌더와 같은 첫 화면을 유지).
  useEffect(() => {
    restoreCategoryScope();
  }, []);

  // 목록은 고정이 있거나 서버 값을 받아야 할 때만 부른다.
  const needCategories =
    hydrated && (pins.length > 0 || Boolean(userId && serverIds && serverIds.length > 0));
  const { data } = useSWR<CategoriesResponse>(needCategories ? CATEGORIES_KEY : null, {
    revalidateOnFocus: false,
  });
  const categories = data?.success ? data.categories : undefined;

  // ② 목록을 받을 때마다 고정 항목을 맞춘다. 사라진 항목이 있으면 안내한다.
  useEffect(() => {
    if (!categories) return;
    const dropped = reconcilePinsWithCategories(categories);
    if (dropped.length === 0) return;
    toast.info(
      `관심 카테고리 '${dropped[0]}'${dropped.length > 1 ? ` 외 ${dropped.length - 1}개` : ""}는 더 이상 제공되지 않아 뺐어요`
    );
  }, [categories]);

  // ③ 서버 동기화. 계정마다 한 번: 브라우저에 고정이 있으면 서버에 올리고, 없으면 서버 값을 받는다.
  //    그 뒤로는 브라우저 고정이 바뀔 때마다 서버에 올린다(실패해도 브라우저 값은 유지한다).
  const syncedUserIdRef = useRef<number | null>(null);
  const lastPushedRef = useRef<string>("");
  useEffect(() => {
    if (!userId || !hydrated) {
      syncedUserIdRef.current = null;
      return;
    }
    const localIds = pins.map((pin) => pin.id);
    const localKey = localIds.join(",");
    if (syncedUserIdRef.current !== userId) {
      const plan = planInitialScopeSync(localIds, serverIds, Boolean(categories));
      if (plan === "wait-categories") return;
      syncedUserIdRef.current = userId;
      if (plan === "adopt" && serverIds && categories) {
        lastPushedRef.current = serverIds.join(",");
        adoptServerPins(serverIds, categories);
        return;
      }
      if (plan === "in-sync") {
        lastPushedRef.current = localKey;
        return;
      }
    }
    if (lastPushedRef.current === localKey) return;
    lastPushedRef.current = localKey;
    void postMe({ pinnedCategoryIds: localIds }).catch(() => {
      // 다음에 고정을 바꾸거나 다시 로그인할 때 다시 올린다.
      lastPushedRef.current = "";
    });
  }, [userId, hydrated, pins, serverIds, categories]);

  // ④ 온보딩을 마쳤다는 표시를 계정과 맞춘다. 앱에서 마쳤으면(전체 보기 포함) 웹에서 다시 묻지 않고,
  //    이 브라우저에서만 마쳤으면 계정에 올린다(실패하면 다음 로그인 때 다시).
  const onboardedPushedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!userId || !hydrated) return;
    const plan = planOnboardedSync(onboarded, serverOnboardedAt);
    if (plan === "adopt") {
      markCategoryOnboardingDone();
      return;
    }
    if (plan !== "push" || onboardedPushedRef.current === userId) return;
    onboardedPushedRef.current = userId;
    void postMe({ categoryOnboarded: true }).catch(() => {
      onboardedPushedRef.current = null;
    });
  }, [userId, hydrated, onboarded, serverOnboardedAt]);

  return null;
}
