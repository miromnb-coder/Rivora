"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: window.location.pathname,
        action: "render",
        message: error.message || "Unexpected application error",
        digest: error.digest || null,
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="app-page-v2">
      <section className="surface mx-auto max-w-2xl p-8">
        <div className="app-kicker-v2">Something went wrong</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
          Nodra could not complete this screen.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          The error has been recorded for the workspace. Retry the action; if it repeats, use the previous workflow step instead of resubmitting the same send action.
        </p>
        {error.digest ? (
          <p className="mt-4 rounded-xl bg-black/[.04] p-3 font-mono text-xs text-[var(--muted)]">
            Error reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={reset} className="btn-primary">Retry</button>
          <Link href="/app/inbox" className="btn-secondary">Back to inbox</Link>
          <Link href="/app/setup" className="btn-secondary">Pilot setup</Link>
        </div>
      </section>
    </div>
  );
}
