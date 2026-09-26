"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      setPending(true);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setPending(false), 8000);
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      const sameDocument =
        url.pathname === current.pathname &&
        url.search === current.search;

      if (sameDocument) return;
      start();
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.dataset.noNavigationProgress === "true") return;
      start();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      className={"nodra-navigation-progress" + (pending ? " is-visible" : "")}
      aria-hidden="true"
    >
      <span />
    </div>
  );
}
