"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = readonly [label: string, href: string, id: string];

export function AppNav({
  items,
  leadAlertCount = 0,
}: {
  items: readonly NavItem[];
  leadAlertCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar-v2-nav" aria-label="Application navigation">
      {items.map(([label, href, id]) => {
        const active =
          pathname === href ||
          (href !== "/app/inbox" && pathname.startsWith(href + "/"));

        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={"app-sidebar-v2-link" + (active ? " is-active" : "")}
          >
            <span>{label}</span>
            {id === "leads" && leadAlertCount > 0 ? (
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
