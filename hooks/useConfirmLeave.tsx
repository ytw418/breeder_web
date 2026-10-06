"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import {
  canPushSentinel,
  createLeaveGuardState,
  createSentinelState,
  planSentinelRemoval,
  sentinelOnPopState,
  sentinelPushed,
  isInterceptableHref,
  leaveGuardTransition,
  shouldBlockLeave,
  type LeaveGuardEvent,
  type LeaveGuardState,
  type LeaveTarget,
  type SentinelState,
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
/** 센티널을 걷어 내는 back() 의 popstate 가 오지 않을 때 대기 중인 이동을 실행하는 시간. */
const SENTINEL_POP_TIMEOUT_MS = 1000;

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
  const sentinelRef = useRef<SentinelState>(createSentinelState());
  const afterPopRef = useRef<Array<() => void>>([]);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const pushSentinel = useCallback(() => {
    if (!canPushSentinel(sentinelRef.current)) return;
    window.history.pushState({ [SENTINEL_KEY]: true }, "");
    sentinelRef.current = sentinelPushed(sentinelRef.current);
  }, []);

  const flushAfterPop = useCallback(() => {
    if (popTimerRef.current) {
      clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
    }
    const queued = afterPopRef.current;
    afterPopRef.current = [];
    queued.forEach((fn) => fn());
  }, []);

  /** 센티널이 있으면 history.back() 으로 걷어 낸 뒤 then 을 실행한다(없으면 바로 실행). */
  const removeSentinel = useCallback(
    (then?: () => void) => {
      const { state, plan } = planSentinelRemoval(sentinelRef.current);
      sentinelRef.current = state;
      if (plan === "run") {
        then?.();
        return;
      }
      if (then) afterPopRef.current.push(then);
      if (plan === "back") {
        window.history.back();
        popTimerRef.current = setTimeout(() => {
          popTimerRef.current = null;
          sentinelRef.current = { present: false, popping: false };
          flushAfterPop();
        }, SENTINEL_POP_TIMEOUT_MS);
      }
    },
    [flushAfterPop]
  );

  // 뒤로가기: dirty 가 되면 같은 URL 센티널을 한 칸 쌓아 두고, 뒤로가기로 센티널이 빠지면 확인 창을 띄운다.
  // 다시 깨끗해지면(dirty→clean) 센티널을 걷어 낸다.
  // 이미 나가기가 허용됐으면(leave()·확인 창 나가기) 다시 dirty 가 돼도 쌓지 않는다 —
  // 저장 성공 뒤 router.replace 가 끝나기 전에 쌓으면 뒤로가기가 빈 작성 화면으로 돌아온다.
  useEffect(() => {
    if (dirty) {
      if (shouldBlockLeave(stateRef.current)) pushSentinel();
    } else removeSentinel();
  }, [dirty, pushSentinel, removeSentinel]);

  useEffect(() => {
    const onPopState = () => {
      const { state, kind } = sentinelOnPopState(sentinelRef.current);
      sentinelRef.current = state;
      if (kind === "removal") {
        flushAfterPop();
        return;
      }
      if (kind !== "userBack") return;
      // 사용자가 뒤로가기로 센티널을 뺐다. 막아야 하면 확인 창, 아니면 실제로 한 칸 더 뒤로 간다.
      if (shouldBlockLeave(stateRef.current)) {
        dispatch({ type: "attempt", target: { kind: "back" } });
      } else {
        window.history.back();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dispatch, flushAfterPop]);

  useEffect(
    () => () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    },
    []
  );

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
    if (wasBack) pushSentinel();
  }, [dispatch, pushSentinel]);

  const confirm = useCallback(() => {
    const target = dispatch({ type: "confirm" });
    if (!target) return;
    // 뒤로가기는 센티널이 이미 빠진 상태다. 그 밖의 이동은 센티널을 걷어 낸 뒤 간다.
    if (target.kind === "back") run(target);
    else removeSentinel(() => run(target));
  }, [dispatch, removeSentinel, run]);

  /** 확인 없이 나간다(저장 성공 후 이동 등). 센티널을 걷어 낸 뒤 fn 을 실행한다. */
  const leave = useCallback(
    (fn: () => void) => {
      dispatch({ type: "allow" });
      removeSentinel(fn);
    },
    [dispatch, removeSentinel]
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
