"use client";

import { useEffect } from "react";

export type MotionToastTone = "success" | "error" | "neutral";

export function MotionToast({
  message,
  tone = "neutral",
  onDismiss,
  duration = 2200,
}: {
  message: string | null;
  tone?: MotionToastTone;
  onDismiss?: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message || !onDismiss) return;

    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onDismiss]);

  if (!message) return null;

  return (
    <div className="averomira-toast-region" aria-live="polite" aria-atomic="true">
      <div className={`averomira-toast is-${tone}`} role={tone === "error" ? "alert" : "status"}>
        {message}
      </div>
    </div>
  );
}
