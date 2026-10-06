"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import {
  createLeaveGuardState,
  isInterceptableHref,
  leaveGuardTransition,
  shouldBlockLeave,
  type LeaveGuardEvent,
  type LeaveGuardState,
  type LeaveTarget,
} from "@libs/client/leaveGuard";

export interface ConfirmLeaveOptions {
  title?: string;
  description?: string;
  /** 머무르기 버튼 문구 */
  stayText?: string;
  /** 나가기 버튼 문구 */
  leaveText?: string;
}

const SENTINEL_KEY = "__bredyLeaveGuard";

/**
 * 작성 중인 내용이 있으면(dirty) 이탈을 막고 확인을 받는다(앱 use-confirm-leave 와 같은 문구).
 * - 새로고침·탭 닫기: beforeunload
 * - 브라우저 뒤로가기: history 센티널 + popstate
 * - 문서 안 링크(a[href]) 클릭: 캡처 단계에서 가로채기
 * 저장 성공 후 이동처럼 확인 없이 나가야 할 때는 `leave(() => router.push(...))` 로 감싼다.
 * 반환된 `dialog` 를 화면 JSX 어딘가에 렌더해야 확인 창이 보인다.
 */
export function useConfirmLeave(
  dirty: boolean,
  options: ConfirmLeaveOptions = {}
): { leave: (fn: () => void) => void; dialog: ReactNode } {
  const router = useRouter();
  const stateRef = useRef<LeaveGuardState>(createLeaveGuardState(dirty));
  const [prompt, setPrompt] = useState<LeaveTarget | null>(null);
  const sentinelRef = useRef(false);

  const run = useCallback(
    (target: LeaveTarget | null) => {
      if (!target) return;
      if (target.kind === "href") router.push(target.href);
      else if (target.kind === "back") window.history.back();
      else target.run();
    },
    [router]
  );

  const dispatch = useCallback(
    (event: LeaveGuardEvent) => {
      const { state, proceed } = leaveGuardTransition(stateRef.current, event);
      stateRef.current = state;
      setPrompt(state.prompt);
      return proceed;
    },
    []
  );

  useEffect(() => {
    dispatch({ type: "setDirty", dirty });
  }, [dirty, dispatch]);

  // 새로고침·탭 닫기
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlockLeave(stateRef.current)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 뒤로가기: dirty 가 되면 같은 URL 센티널을 한 칸 쌓아 두고, 뒤로가기로 센티널이 빠지면 확인 창을 띄운다.
  useEffect(() => {
    if (!dirty || sentinelRef.current) return;
    window.history.pushState({ [SENTINEL_KEY]: true }, "");
    sentinelRef.current = true;
  }, [dirty]);

  useEffect(() => {
    const onPopState = () => {
      if (!sentinelRef.current) return;
      // 센티널이 빠졌다(뒤로가기). 막아야 하면 확인 창, 아니면 실제로 한 칸 더 뒤로 간다.
      sentinelRef.current = false;
      if (shouldBlockLeave(stateRef.current)) {
        dispatch({ type: "attempt", target: { kind: "back" } });
      } else {
        window.history.back();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dispatch]);

  // 문서 안 링크 클릭 가로채기(캡처 단계라 next/link 보다 먼저 받는다).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!shouldBlockLeave(stateRef.current)) return;
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (
        !isInterceptableHref(href, window.location.href, {
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          modifier: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        })
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const url = new URL(href as string, window.location.href);
      dispatch({
        type: "attempt",
        target: { kind: "href", href: `${url.pathname}${url.search}${url.hash}` },
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dispatch]);

  const cancel = useCallback(() => {
    const wasBack = stateRef.current.prompt?.kind === "back";
    dispatch({ type: "cancel" });
    // 뒤로가기를 취소했으면 센티널을 다시 쌓는다.
    if (wasBack && !sentinelRef.current) {
      window.history.pushState({ [SENTINEL_KEY]: true }, "");
      sentinelRef.current = true;
    }
  }, [dispatch]);

  const confirm = useCallback(() => {
    run(dispatch({ type: "confirm" }));
  }, [dispatch, run]);

  const leave = useCallback(
    (fn: () => void) => {
      dispatch({ type: "allow" });
      fn();
    },
    [dispatch]
  );

  const dialog = (
    <ConfirmDialog
      open={prompt !== null}
      title={options.title ?? "작성을 그만둘까요?"}
      description={options.description ?? "지금 나가면 입력한 내용이 사라져요."}
      cancelText={options.stayText ?? "계속 작성"}
      confirmText={options.leaveText ?? "나가기"}
      tone="danger"
      onCancel={cancel}
      onConfirm={confirm}
    />
  );

  return { leave, dialog };
}

export default useConfirmLeave;
