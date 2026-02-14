"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { capturePosthogError } from "@libs/client/posthog";

const Error = ({ error, reset }: { error: Error; reset: () => void }) => {
  useEffect(() => {
    console.error("[app/error]", error);
    Sentry.captureException(error);
    capturePosthogError({
      source: "app_error_boundary",
      error,
      context: {
        digest:
          typeof (error as Error & { digest?: string }).digest === "string"
            ? (error as Error & { digest?: string }).digest
            : null,
      },
    });
  }, [error]);
  return <div>{error.message}</div>;
};

export default Error;
