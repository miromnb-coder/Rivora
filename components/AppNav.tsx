"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = readonly [label: string, href: string, id: string];

export function AppNav({
  items,
}: {
  items: readonly NavItem[];
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [leadAlertCount, setLeadAlertCount] = useState(0);
  const hasLeads = items.some(([, , id]) => id === "leads");

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!hasLeads) return;

    let cancelled = false;

    fetch("/api/leads/alert-count")
      .then((response) => (response.ok ? response.json() : { count: 0 }))
      .then((result: { count?: number }) => {
        if (!cancelled) setLeadAlertCount(Number(result.count ?? 0));
      })
      .catch(() => {
        if (!cancelled) setLeadAlertCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [hasLeads]);

  return (
    <nav className="app-sidebar-v2-nav" aria-label="Application navigation">
      {items.map(([label, href, id]) => {
        const active =
          pathname === href ||
          (href !== "/app/inbox" && pathname.startsWith(href + "/"));
        const pending = pendingHref === href && !active;

        return (
          <Link
            key={href}
            href={href}
            prefetch
            onClick={() => {
              if (!active) setPendingHref(href);
            }}
            aria-current={active ? "page" : undefined}
            className={
              "app-sidebar-v2-link" +
              (active ? " is-active" : "") +
              (pending ? " is-pending" : "")
            }
          >
            <span>{label}</span>
            {pending ? <span className="app-nav-pending-dot" aria-hidden="true" /> : null}
            {!pending && id === "leads" && leadAlertCount > 0 ? (
              <span className="app-sidebar-v2-badge">
                {leadAlertCount > 99 ? "99+" : leadAlertCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
