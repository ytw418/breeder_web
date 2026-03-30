"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";

type ToastTone = "success" | "error" | "info" | "warning" | "loading";

const ToastGlyph = ({
  tone,
  children,
}: {
  tone: ToastTone;
  children: ReactNode;
}) => (
  <span className={`app-sonner-glyph app-sonner-glyph-${tone}`}>
    {children}
  </span>
);

export default function AppToastContainer() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Toaster
      className="app-sonner-toaster"
      position="top-center"
      visibleToasts={4}
      expand={false}
      closeButton
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      offset={{
        top: "calc(env(safe-area-inset-top) + 16px)",
        left: 16,
        right: 16,
      }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top) + 12px)",
        left: 12,
        right: 12,
      }}
      icons={{
        success: (
          <ToastGlyph tone="success">
            <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </ToastGlyph>
        ),
        error: (
          <ToastGlyph tone="error">
            <CircleAlert className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </ToastGlyph>
        ),
        info: (
          <ToastGlyph tone="info">
            <Info className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </ToastGlyph>
        ),
        warning: (
          <ToastGlyph tone="warning">
            <TriangleAlert className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </ToastGlyph>
        ),
        loading: (
          <ToastGlyph tone="loading">
            <LoaderCircle
              className="h-[18px] w-[18px] animate-spin"
              strokeWidth={2.2}
            />
          </ToastGlyph>
        ),
        close: <X className="h-3.5 w-3.5" strokeWidth={2.2} />,
      }}
      toastOptions={{
        duration: 2600,
        unstyled: true,
        classNames: {
          toast: "app-sonner-toast",
          content: "app-sonner-content",
          title: "app-sonner-title",
          description: "app-sonner-description",
          icon: "app-sonner-icon",
          closeButton: "app-sonner-close",
          actionButton: "app-sonner-action",
          cancelButton: "app-sonner-cancel",
          success: "app-sonner-success",
          error: "app-sonner-error",
          info: "app-sonner-info",
          warning: "app-sonner-warning",
          loading: "app-sonner-loading",
          default: "app-sonner-default",
        },
      }}
    />
  );
}
