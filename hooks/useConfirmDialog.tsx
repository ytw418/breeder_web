"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@components/atoms/ConfirmDialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
};

type DialogState = ConfirmOptions & {
  open: boolean;
};

const DEFAULT_OPTIONS: Omit<ConfirmOptions, "title"> = {
  description: "",
  confirmText: "확인",
  cancelText: "취소",
  tone: "default",
};

export default function useConfirmDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (resolveRef.current) {
        resolveRef.current(false);
      }
      resolveRef.current = resolve;
      setState({
        ...DEFAULT_OPTIONS,
        ...options,
        open: true,
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resolveRef.current) {
        resolveRef.current(false);
        resolveRef.current = null;
      }
    };
  }, []);

  const confirmDialog = useMemo(() => {
    if (!state) return null;
    return (
      <ConfirmDialog
        open={state.open}
        title={state.title}
        description={state.description}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        tone={state.tone}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    );
  }, [close, state]);

  return {
    confirm,
    confirmDialog,
    isOpen: Boolean(state?.open),
  };
}
