"use client";

import { useEffect, useState, type RefObject } from "react";

export type WorkspaceMode = "mobile" | "tablet" | "overlay" | "desktop";

// One measured border-box width owns CSS geometry and dialog modality. Unlike
// matchMedia this accounts for the space occupied by a classic scrollbar.
export function useWorkspaceLayout(root: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [root]);
  const mode: WorkspaceMode = width === null || width < 768 ? "mobile" : width < 1024 ? "tablet" : width < 1200 ? "overlay" : "desktop";
  return { width, mode, rail: width !== null && width >= 1920 ? "400px" : width !== null && width >= 1600 ? "384px" : "340px" };
}

export function usePanelPresence(open: boolean) {
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">(open ? "opening" : "closed");
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      if (reduced.matches) { setPhase(open ? "open" : "closed"); return; }
      if (open) {
        setPhase("opening");
        timer = setTimeout(() => setPhase("open"), 280);
      } else {
        setPhase(current => current === "closed" ? "closed" : "closing");
        timer = setTimeout(() => setPhase("closed"), 200);
      }
    };
    update();
    reduced.addEventListener("change", update);
    return () => { clearTimeout(timer); reduced.removeEventListener("change", update); };
  }, [open]);
  return { phase, present: open || phase !== "closed" };
}
