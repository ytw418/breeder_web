"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import Layout from "@components/features/MainLayout";
import { useCelebrateSheet } from "@components/features/celebrate/CelebrateSheet";
import useConfirmLeave from "hooks/useConfirmLeave";
import useUser from "hooks/useUser";
import { createDebate, updateDebate } from "@libs/client/liveTalkApi";
import { MY_ACTIVITY_KEY_PREFIXES, POST_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import type { CategoriesResponse } from "@libs/shared/categories";
import type { Celebrate } from "@libs/shared/communityVibe";
import {
  DEBATE_DEFAULT_DURATION,
  DEBATE_DEFAULT_OPTIONS,
  DEBATE_DESCRIPTION_MAX,
  DEBATE_DURATIONS_HOURS,
  DEBATE_OPTION_MAX,
  DEBATE_QUESTION_MAX,
  durationLabel,
  validateDebateInput,
  type DebateDurationHours,
} from "@libs/shared/debateFormat";
import type { PostDetailResponse } from "pages/api/posts/[id]";
import { PostComposerHeader } from "../_components/PostComposer";
import { SpeciesPickerSheet, defaultSpeciesFromPins } from "../_components/SpeciesPickerSheet";

/**
 * 토론 열기 / 토론 수정(앱 docs/prd/live-talk.md §3.7, 시안 ⑦ — 앱 src/app/posts/debate.tsx 와 같다).
 * 종 행(52) → 질문 20/700 + "26/40" → 선택지 2칸(기본 찬성·반대) → 기간 칩 3일(기본)·7일·24시간 → 왜 궁금한지(선택, 1000자) → 안내 → 아래 고정 '토론 열기'.
 * 수정(?edit=글 id): 다른 사람이 처음 투표하기 전엔 질문·선택지·설명, 그 뒤엔 설명만. 기간은 못 바꾼다.
 * 비슷한 토론 열기(?species=)는 종을 미리 고른다.
 */
export default function DebateComposeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = Number(params?.get("edit")) || null;
  const presetSpecies = params?.get("species") ?? "";
  const { mutate: globalMutate, cache: swrCache } = useSWRConfig();
  const { user } = useUser();

  const { data: editData } = useSWR<PostDetailResponse>(editId ? `/api/posts/${editId}` : null);
  const editPost = editData?.post ?? null;
  const editDebate = editData?.debate ?? null;
  const locked = Boolean(editId && editDebate && !editDebate.editable);

  const [species, setSpecies] = useState(presetSpecies);
  const [title, setTitle] = useState("");
  const [optionA, setOptionA] = useState<string>(DEBATE_DEFAULT_OPTIONS.A);
  const [optionB, setOptionB] = useState<string>(DEBATE_DEFAULT_OPTIONS.B);
  const [duration, setDuration] = useState<DebateDurationHours>(DEBATE_DEFAULT_DURATION);
  const [description, setDescription] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  // 수정: 받은 값으로 한 번 채운다.
  const filled = useRef(false);
  useEffect(() => {
    if (!editId || filled.current || !editPost || !editDebate) return;
    filled.current = true;
    setTitle(editPost.title);
    setDescription(editPost.description ?? "");
    setOptionA(editDebate.optionA);
    setOptionB(editDebate.optionB);
    setSpecies(editPost.type ?? "");
    setInitialSnapshot(JSON.stringify([editPost.title, editDebate.optionA, editDebate.optionB, editPost.description ?? ""]));
  }, [editId, editPost, editDebate]);

  // 새 토론: 관심 카테고리를 하나만 고정했으면 종을 미리 채운다(글쓰기와 같다).
  const { data: categoriesData } = useSWR<CategoriesResponse>(editId ? null : "/api/categories");
  const speciesTouched = useRef(Boolean(editId || presetSpecies));
  useEffect(() => {
    if (speciesTouched.current || !user || !categoriesData) return;
    speciesTouched.current = true;
    const preset = defaultSpeciesFromPins(categoriesData.categories, user.pinnedCategoryIds);
    if (preset) setSpecies(preset);
  }, [user, categoriesData]);

  const checked = validateDebateInput({ title, optionA, optionB, durationHours: duration, description });
  const changed = editId
    ? initialSnapshot !== null && initialSnapshot !== JSON.stringify([title, optionA, optionB, description])
    : Boolean(title.trim() || description.trim());
  const canSubmit = checked.ok && !submitting && (!editId || changed);
  const { leave, dialog } = useConfirmLeave(changed && !submitting);
  const celebrateSheet = useCelebrateSheet("post");

  const close = () => {
    if (window.history.length > 1) router.back();
    else router.replace(editPost ? toPostPath(editPost.id, editPost.title) : "/");
  };

  const submit = async () => {
    if (!canSubmit) {
      if (!checked.ok) toast.error(checked.message);
      return;
    }
    setSubmitting(true);
    if (editId && editPost) {
      const res = await updateDebate(editId, { title, description, optionA, optionB });
      setSubmitting(false);
      if (!res.ok) return void toast.error(res.data.error ?? "토론을 고치지 못했어요");
      toast.success(res.data.locked ? "설명을 고쳤어요" : "토론을 고쳤어요");
      revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, POST_KEY_PREFIXES);
      void globalMutate(`/api/posts/${editId}`);
      leave(() => router.replace(toPostPath(editId, title.trim() || editPost.title)));
      return;
    }
    const res = await createDebate({ title, description, species: species || null, optionA, optionB, durationHours: duration });
    setSubmitting(false);
    if (!res.ok || !res.data.post) {
      return void toast.error(res.data.error ?? "토론을 열지 못했어요. 다시 시도해 주세요");
    }
    revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, [...POST_KEY_PREFIXES, ...MY_ACTIVITY_KEY_PREFIXES]);
    const path = toPostPath(res.data.post.id, res.data.post.title);
    const celebrate = (res.data as { celebrate?: Celebrate | null }).celebrate;
    if (!celebrate) toast.success("토론을 열었어요");
    celebrateSheet.show(celebrate, () => leave(() => router.replace(path)));
  };

  const screenTitle = editId ? "토론 수정" : "토론 열기";
  const loadingEdit = Boolean(editId && !editPost);

  return (
    <Layout headerVariant="none" seoTitle={screenTitle}>
      <PostComposerHeader title={screenTitle} onClose={close} closeDisabled={submitting} />

      {loadingEdit ? (
        <p className="py-16 text-center text-[14px] text-app-muted">불러오는 중이에요</p>
      ) : (
        <div className="pb-[calc(84px+env(safe-area-inset-bottom))]">
          {/* 종 행 52 */}
          <button
            type="button"
            disabled={Boolean(editId)}
            onClick={() => setPickerOpen(true)}
            className="flex h-[52px] w-full items-center gap-2 border-b border-app-line px-4 text-left text-[15px]"
          >
            <span className="text-app-muted">종</span>
            <span className={cn("ml-auto truncate", species ? "font-medium text-app-text" : "text-app-muted")}>
              {species || "선택"}
            </span>
            {!editId ? (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0 text-app-caption" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            ) : null}
          </button>

          {locked ? (
            <p className="mx-4 mt-3 rounded-lg bg-app-gap px-3 py-2.5 text-[13px] leading-[18px] text-app-sub">
              다른 사람이 투표한 뒤라 설명만 고칠 수 있어요
            </p>
          ) : null}

          {/* 질문 */}
          <textarea
            value={title}
            disabled={locked}
            onChange={(event) => setTitle(event.target.value.replace(/\n/g, " ").slice(0, DEBATE_QUESTION_MAX))}
            rows={2}
            placeholder="어떤 걸 두고 이야기할까요?"
            aria-label="질문"
            className="block w-full resize-none border-0 bg-transparent px-4 pb-1.5 pt-[18px] text-[20px] font-bold leading-7 tracking-[-0.4px] text-app-text outline-none placeholder:text-app-caption focus:ring-0 disabled:opacity-60"
          />
          <p className="px-4 text-right text-[12px] text-app-muted tabular-nums">
            {title.trim().length}/{DEBATE_QUESTION_MAX}
          </p>

          {/* 선택지 */}
          <p className="px-4 pb-2 pt-5 text-[13px] font-semibold text-app-muted">선택지</p>
          {([
            ["A", optionA, setOptionA],
            ["B", optionB, setOptionB],
          ] as const).map(([side, value, setValue]) => (
            <label
              key={side}
              className="mx-4 mb-2 flex h-12 items-center gap-2.5 rounded-lg bg-app-gap px-3.5"
            >
              <i className={cn("block h-2.5 w-2.5 shrink-0 rounded-full", side === "A" ? "bg-app-brand" : "bg-app-text")} />
              <input
                value={value}
                disabled={locked}
                onChange={(event) => setValue(event.target.value.slice(0, DEBATE_OPTION_MAX))}
                aria-label={side === "A" ? "첫 번째 선택지" : "두 번째 선택지"}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold text-app-text outline-none focus:ring-0 disabled:opacity-60"
              />
              <span className="shrink-0 text-[12px] text-app-muted tabular-nums">
                {value.trim().length}/{DEBATE_OPTION_MAX}
              </span>
            </label>
          ))}
          <p className="px-4 text-[12px] leading-4 text-app-muted">
            기본은 찬성·반대예요. &apos;냉동 vs 생먹이&apos;처럼 바꿔도 돼요
          </p>

          {/* 기간 */}
          <p className="px-4 pb-2 pt-5 text-[13px] font-semibold text-app-muted">기간</p>
          <div className="flex gap-2 px-4">
            {DEBATE_DURATIONS_HOURS.map((hours) => {
              const on = duration === hours;
              return (
                <button
                  key={hours}
                  type="button"
                  disabled={Boolean(editId)}
                  aria-pressed={on}
                  onClick={() => setDuration(hours)}
                  className={cn(
                    "flex h-8 items-center rounded-full border px-3.5 text-[13px]",
                    on
                      ? "border-app-inverse bg-app-inverse font-semibold text-app-inverse-text"
                      : "border-app-border bg-app-bg font-medium text-app-sub",
                    editId && !on ? "opacity-50" : null
                  )}
                >
                  {durationLabel(hours)}
                  {hours === DEBATE_DEFAULT_DURATION ? " (기본)" : ""}
                </button>
              );
            })}
          </div>

          {/* 설명 */}
          <p className="px-4 pb-2 pt-5 text-[13px] font-semibold text-app-muted">왜 궁금한지 (선택)</p>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, DEBATE_DESCRIPTION_MAX))}
            placeholder="상황을 적어 주면 의견이 더 잘 모여요"
            aria-label="설명"
            className="mx-4 block min-h-[92px] w-[calc(100%-32px)] resize-y rounded-lg border-0 bg-app-gap px-3.5 py-3 text-[15px] leading-[22px] text-app-text outline-none placeholder:text-app-caption focus:ring-0"
          />

          <p className="px-4 pt-4 text-[12px] leading-[18px] text-app-muted">
            토론은 하루 3개까지 열 수 있어요. 특정 사람·업체를 겨냥한 토론은 가려져요.
          </p>
        </div>
      )}

      {/* 아래 고정 '토론 열기' 52 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-app-line bg-app-bg px-4 pb-[max(calc(env(safe-area-inset-bottom)+12px),20px)] pt-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className={cn(
            "flex h-[52px] w-full items-center justify-center rounded-lg text-[16px] font-semibold",
            canSubmit ? "bg-app-brand text-white" : "bg-app-placeholder text-app-caption"
          )}
        >
          {submitting ? (editId ? "고치는 중…" : "여는 중…") : editId ? "수정하기" : "토론 열기"}
        </button>
      </div>

      <SpeciesPickerSheet
        open={pickerOpen}
        title="종"
        value={species}
        suggestedIds={user?.pinnedCategoryIds}
        onSelect={(name) => {
          speciesTouched.current = true;
          setSpecies(name);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      {celebrateSheet.sheet}
      {dialog}
    </Layout>
  );
}
