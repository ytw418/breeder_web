"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div>
          <h2>문제가 발생했습니다.</h2>
          <p>잠시 후 다시 시도해 주세요.</p>
          <button type="button" onClick={reset}>
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
