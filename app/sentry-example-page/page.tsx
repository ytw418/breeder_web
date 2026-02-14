"use client";

import { useState } from "react";

export default function SentryExamplePage() {
  const [loading, setLoading] = useState(false);

  const triggerClientError = () => {
    throw new Error("Sentry test error from /sentry-example-page");
  };

  const triggerApiError = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sentry-example-api");
      if (!res.ok) throw new Error(`API status ${res.status}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Sentry Test Page</h1>
      <p className="mt-3 text-sm text-slate-600">
        버튼을 눌러 Sentry 이벤트가 들어오는지 확인하세요.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={triggerClientError}
          className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Trigger Client Error
        </button>
        <button
          type="button"
          onClick={triggerApiError}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Sending..." : "Trigger API Error"}
        </button>
      </div>
    </main>
  );
}
