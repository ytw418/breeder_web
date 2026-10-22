"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hand } from "lucide-react";
import { useSWRConfig } from "swr";

import { BottomSheet } from "@components/app/BottomSheet";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import {
  waveButtonLabel,
  waveButtonState,
  waveErrorMessage,
  WAVE_PRESETS,
  WAVE_SENT_MESSAGE,
  WAVE_SHEET_TITLE,
  waveSheetCaption,
  wavesLeftCaption,
  type WavePresetId,
} from "@libs/shared/chatWave";

/** 동네 목록 SWR 키(limit 만 다르다)를 모두 다시 받는다. */
const isNearbyKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/users/nearby");

/**
 * 동네 브리더 '손 흔들어 인사하기'(앱 components/features/chat/WaveButton.tsx 와 같은 동작).
 * 32 원형 버튼(brand-soft·brand 손) → 시트에서 문구 3개 중 하나 → 보내면 채팅방이 생기고 '채팅 보기' 토스트.
 * 이미 인사했으면 회색 '인사함'(누를 수 없음), 오늘 10명을 채웠으면 누를 때 안내만 띄운다.
 * variant "pill": 홈 동네 카드에서 팔로우 버튼과 같은 너비·높이(30 r8)로 손 + '인사'를 나란히 둔다(2026-10-22 사용자
 * "팔로잉이랑 손바닥 아이콘 위치가 제각각"). 앱 WaveButton variant 와 같다.
 */
export default function WaveButton({
  userId,
  name,
  waved,
  wavesLeftToday,
  className,
  variant = "circle",
}: {
  userId: number;
  name: string;
  waved?: boolean;
  wavesLeftToday?: number;
  className?: string;
  variant?: "circle" | "pill";
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<WavePresetId>(WAVE_PRESETS[0].id);
  const [sending, setSending] = useState(false);
  const [sentHere, setSentHere] = useState(false);
  const state = sentHere ? "waved" : waveButtonState({ waved, wavesLeftToday });
  const label = waveButtonLabel(state);

  const onPress = () => {
    if (state === "waved") return;
    if (state === "limit") {
      toast.info(wavesLeftCaption(0) ?? waveErrorMessage("WAVE_LIMIT"));
      return;
    }
    setOpen(true);
  };

  const openChat = (chatRoomId?: number) => {
    if (chatRoomId) router.push(`/chat/${chatRoomId}`);
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await authFetch("/api/chat/wave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherId: userId, presetId: picked }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        errorCode?: string;
        error?: string;
        chatRoomId?: number;
      };
      if (data.success || data.errorCode === "WAVE_ALREADY") {
        setSentHere(true);
        setOpen(false);
        const message = data.success ? WAVE_SENT_MESSAGE : waveErrorMessage("WAVE_ALREADY");
        toast.success(message, data.chatRoomId ? { action: { label: "채팅 보기", onClick: () => openChat(data.chatRoomId) } } : undefined);
      } else {
        toast.error(data.error || waveErrorMessage(data.errorCode));
        if (data.errorCode === "WAVE_LIMIT") setOpen(false);
      }
      void mutate(isNearbyKey);
    } catch {
      toast.error(waveErrorMessage(null));
    } finally {
      setSending(false);
    }
  };

  const caption = wavesLeftCaption(wavesLeftToday);

  return (
    <>
      <button
        type="button"
        onClick={onPress}
        aria-label={state === "ready" ? `${name}님에게 ${label}` : label}
        aria-disabled={state === "waved"}
        title={label}
        className={cn(
          variant === "pill"
            ? "flex h-[30px] w-full items-center justify-center gap-1 rounded-lg text-[13px] font-semibold transition-colors"
            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
          state === "waved" ? "cursor-default bg-app-surface text-app-muted" : "bg-app-brand-soft text-app-brand",
          className
        )}
      >
        <Hand className={variant === "pill" ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2} aria-hidden="true" />
        {variant === "pill" ? (
          <span className={state === "waved" ? undefined : "text-app-brand-text"}>{state === "waved" ? "인사함" : "인사"}</span>
        ) : null}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={WAVE_SHEET_TITLE}
        footer={
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-app-brand text-[16px] font-semibold text-white disabled:opacity-60"
          >
            {sending ? "보내는 중…" : "인사 보내기"}
          </button>
        }
      >
        <p className="px-4 pb-3 text-[14px] text-app-muted">{waveSheetCaption(name)}</p>
        <div role="radiogroup" aria-label="인사 문구" className="flex flex-col gap-2 px-4">
          {WAVE_PRESETS.map((preset) => {
            const selected = preset.id === picked;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPicked(preset.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-[15px] leading-[22px] transition-colors",
                  selected
                    ? "border-app-brand bg-app-brand-soft font-semibold text-app-text"
                    : "border-app-border bg-app-elevated text-app-sub"
                )}
              >
                {preset.text}
              </button>
            );
          })}
        </div>
        {caption ? <p className="px-4 pt-3 text-[13px] text-app-muted">{caption}</p> : null}
      </BottomSheet>
    </>
  );
}
