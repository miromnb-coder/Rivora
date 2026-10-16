"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/locale";
import { SUPPORT_OPEN_EVENT, SUPPORT_UNREAD_EVENT } from "@/components/support/ContextHelpTrigger";

export function WorkspaceSupportTrigger({ locale }: { locale: Locale }) {
  const [unread, setUnread] = useState(0);
  const fi = locale === "fi";

  useEffect(() => {
    function onCount(event: Event) {
      const count = (event as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof count === "number" && Number.isFinite(count)) {
        setUnread(Math.max(0, Math.floor(count)));
      }
    }
    window.addEventListener(SUPPORT_UNREAD_EVENT, onCount);
    return () => window.removeEventListener(SUPPORT_UNREAD_EVENT, onCount);
  }, []);

  return (
    <button
      type="button"
      className="ml-workspace-help"
      aria-label={fi ? "Avaa Ohje ja tuki" : "Open Help and Support"}
      title={fi ? "Ohje ja tuki" : "Help and Support"}
      onClick={() => window.dispatchEvent(new CustomEvent(SUPPORT_OPEN_EVENT))}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M9.8 9.2a2.45 2.45 0 0 1 4.5 1.2c0 1.7-1.55 2.1-2.3 3.25" />
        <path d="M12 17h.01" />
      </svg>
      <span className="ml-workspace-help-label">{fi ? "Ohje ja tuki" : "Help and Support"}</span>
      {unread > 0 ? (
        <span className="ml-workspace-help-count" aria-label={fi ? `${unread} uutta tukivastausta` : `${unread} new support replies`}>
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}
