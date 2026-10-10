"use client";
/**
 * 알림 권유 바텀시트(앱 components/features/PushPermissionPrompt.tsx, 대응표 O-2). libs/client/pushPrompt.ts 가 연다.
 * 로그인한 상태로 온보딩·로그인 밖 화면에 오면 이 브라우저에 한 번 권유를 확인한다(앱은 설치 후 첫 실행).
 * 톤은 앱과 같다(overlay, app-elevated, 위 모서리 16, 핸들 40x4, 벨 28, 제목 18/700, 본문 15/22, 52 버튼 두 개).
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { BottomSheet } from "@components/app/BottomSheet";
import {
  closePushPrompt,
  promptPushOnWelcome,
  subscribePushPrompt,
  type PushPromptReason,
  type PushPromptRequest,
} from "@libs/client/pushPrompt";
import { toast } from "@libs/client/toast";
import { PUSH_SUBSCRIPTION_KEY, WebPushPermissionError, enableWebPush } from "@libs/client/webPush";
import useUser from "hooks/useUser";

const COPY: Record<PushPromptReason, { title: string; body: string; confirm: string }> = {
  welcome: {
    title: "알림을 켜고 소식을 바로 받아보세요",
    body: "채팅 메시지, 경매 입찰·낙찰, 댓글과 찜 소식을 바로 알려드려요. 알림은 설정에서 언제든 끌 수 있어요.",
    confirm: "알림 받기",
  },
  product: {
    title: "분양 문의를 놓치지 않게 알림을 켜 주세요",
    body: "알림이 꺼져 있으면 입양자가 채팅을 보내도 바로 알려드릴 수 없어요.",
    confirm: "알림 켜기",
  },
};

/** 웹은 브라우저 설정을 대신 열 수 없어 경로를 글로 안내하고, 버튼은 설정 화면(권한 복구 안내)으로 보낸다. */
const BLOCKED_GUIDE = "브라우저 설정 > 사이트 권한 > 알림에서 브리디를 허용해 주세요.";

/** 로그인·온보딩 중에는 묻지 않는다(웹 온보딩은 첫 로그인 직후, O-1). */
const WELCOME_EXCLUDED_PATHS = ["/onboarding", "/auth", "/login-loading", "/admin", "/e2e", "/share", "/offline"];
/** 첫 화면이 그려지고 온보딩으로 넘어가는 이동이 끝난 뒤에 확인한다. */
const WELCOME_DELAY_MS = 1500;

const BELL_PATH =
  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9";

export const isWelcomeExcludedPath = (pathname: string) =>
  WELCOME_EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export default function PushPermissionPrompt() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { user } = useUser();
  const { mutate } = useSWRConfig();
  const userId = user?.id;
  const [request, setRequest] = useState<PushPromptRequest | null>(null);
  const excluded = isWelcomeExcludedPath(pathname);

  useEffect(() => subscribePushPrompt(setRequest), []);

  useEffect(() => {
    if (!userId || excluded) return;
    const timer = setTimeout(() => void promptPushOnWelcome(), WELCOME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, excluded]);

  const handleConfirm = async () => {
    if (!request) return;
    closePushPrompt();
    if (request.permission === "denied") {
      router.push("/settings");
      return;
    }
    if (!userId) return;
    try {
      await enableWebPush(userId, request.status);
      await mutate(PUSH_SUBSCRIPTION_KEY);
      toast.success("알림이 켜졌습니다.");
    } catch (error) {
      if (error instanceof WebPushPermissionError) {
        toast("알림은 설정에서 언제든 켤 수 있어요.");
        return;
      }
      toast.error("알림을 켜지 못했어요. 설정에서 다시 시도해 주세요.");
    }
  };

  const copy = request ? COPY[request.reason] : null;
  const blocked = request?.permission === "denied";

  return (
    <BottomSheet open={Boolean(copy)} onClose={closePushPrompt} ariaLabel={copy?.title}>
      {copy ? (
        <div className="px-4 pb-4">
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-text">
            <path d={BELL_PATH} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 break-keep text-[18px] font-bold tracking-[-0.3px] text-app-text">{copy.title}</p>
          <p className="mt-2 break-keep text-[15px] leading-[22px] text-app-muted">
            {blocked ? `${copy.body} ${BLOCKED_GUIDE}` : copy.body}
          </p>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={closePushPrompt}
              className="h-[52px] flex-1 rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="h-[52px] flex-1 rounded-md bg-app-brand text-[16px] font-semibold text-white"
            >
              {blocked ? "설정 보기" : copy.confirm}
            </button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
