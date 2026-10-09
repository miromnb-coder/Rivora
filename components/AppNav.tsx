"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = readonly [label: string, href: string, id: string];
type SubItem = readonly [label: string, href: string];

function isItemActive(pathname: string, href: string, id: string) {
  if (id === "dashboard") return pathname === "/app";

  if (id === "orders") {
    return (
      pathname === "/app/orders" ||
      pathname.startsWith("/app/orders/") ||
      pathname.startsWith("/app/inbox") ||
      pathname.startsWith("/app/rfq/") ||
      pathname.startsWith("/app/quotes") ||
      pathname.startsWith("/app/purchase-orders") ||
      pathname.startsWith("/app/sales-orders") ||
      pathname === "/app/upload" ||
      pathname.startsWith("/app/templates")
    );
  }

  if (id === "settings") {
    return (
      pathname === "/app/settings" ||
      pathname.startsWith("/app/settings/") ||
      pathname === "/app/memory"
    );
  }

  return pathname === href || pathname.startsWith(href + "/");
}

function NavIcon({ id }: { id: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.95,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (id === "dashboard") {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="2.25" />
        <circle cx="17" cy="7" r="2.25" />
        <circle cx="7" cy="17" r="2.25" />
        <circle cx="17" cy="17" r="2.25" />
      </svg>
    );
  }

  if (id === "orders") {
    return (
      <svg {...common}>
        <rect x="4" y="7.5" width="16" height="12" rx="3" />
        <path d="M8.5 7.5V5.8c0-1 .8-1.8 1.8-1.8h3.4c1 0 1.8.8 1.8 1.8v1.7" />
      </svg>
    );
  }

  if (id === "leads") {
    return (
      <svg {...common}>
        <path d="M5 6.5h14" />
        <path d="M5 11.5h9" />
        <path d="M5 16.5h7" />
        <circle cx="18" cy="16.5" r="2" />
      </svg>
    );
  }

  if (id === "customers") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M6.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5" />
      </svg>
    );
  }

  if (id === "products") {
    return (
      <svg {...common}>
        <rect x="4" y="7" width="16" height="13" rx="3" />
        <path d="M8 7V5.8C8 4.8 8.8 4 9.8 4h4.4c1 0 1.8.8 1.8 1.8V7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.2 12c0-.5 0-.9-.1-1.3l1.8-1.4-1.9-3.2-2.2.9a7.6 7.6 0 0 0-2.3-1.3L14.2 3h-4.4l-.3 2.7A7.6 7.6 0 0 0 7.2 7L5 6.1 3.1 9.3l1.8 1.4A8.3 8.3 0 0 0 4.8 12c0 .5 0 .9.1 1.3l-1.8 1.4L5 17.9l2.2-.9a7.6 7.6 0 0 0 2.3 1.3l.3 2.7h4.4l.3-2.7a7.6 7.6 0 0 0 2.3-1.3l2.2.9 1.9-3.2-1.8-1.4c.1-.4.1-.8.1-1.3Z" />
    </svg>
  );
}

export function AppNav({ items, compact = false, locale = "fi" }: {
  items: readonly NavItem[];
  compact?: boolean;
  locale?: "fi" | "en";
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => { setPendingHref(null); }, [pathname]);
  return (
    <nav className={"app-sidebar-v2-nav" + (compact ? " is-compact" : "")}
      aria-label={locale === "fi" ? "Sovelluksen päävalikko" : "Application main navigation"}>
      {items.map(([label, href, id]) => {
        const active = isItemActive(pathname, href, id);
        const pending = pendingHref === href && pathname !== href;
        return (
          <Link key={href} href={href} prefetch
            onClick={() => { if (pathname !== href) setPendingHref(href); }}
            aria-current={pathname === href ? "page" : active ? "location" : undefined}
            aria-busy={pending || undefined}
            className={"app-sidebar-v2-link app-sidebar-v2-link-" + id +
              (active ? " is-active" : "") + (pending ? " is-pending" : "")}>
            <span className="app-nav-main">
              <span className="app-nav-icon"><NavIcon id={id} /></span>
              <span className="app-nav-label">{label}</span>
            </span>
            {pending ? <span className="app-nav-pending-dot" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
