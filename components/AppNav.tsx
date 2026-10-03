"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = readonly [label: string, href: string, id: string];

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
      pathname.startsWith("/app/sales-orders")
    );
  }

  return pathname === href || pathname.startsWith(href + "/");
}

function NavIcon({ id }: { id: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (id === "dashboard") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
      </svg>
    );
  }

  if (id === "orders") {
    return (
      <svg {...common}>
        <path d="M7 3.5h7l3 3V20.5H7z" />
        <path d="M14 3.5v3h3" />
        <path d="M9.5 11h5M9.5 14.5h5" />
      </svg>
    );
  }

  if (id === "customers") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.8 19c.7-3.2 2.5-5 5.2-5s4.5 1.8 5.2 5" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M15.8 14.2c2.5.2 4 1.8 4.5 4.3" />
      </svg>
    );
  }

  if (id === "products") {
    return (
      <svg {...common}>
        <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" />
        <path d="m4 8 8 4.5L20 8M12 12.5v8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7.6 7.6 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 2.1 1.2L10 21h4l.4-2.7a7.6 7.6 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  );
}

export function AppNav({
  items,
}: {
  items: readonly NavItem[];
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className="app-sidebar-v2-nav" aria-label="Application navigation">
      {items.map(([label, href, id]) => {
        const active = isItemActive(pathname, href, id);
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
              "app-sidebar-v2-link app-sidebar-v2-link-" +
              id +
              (active ? " is-active" : "") +
              (pending ? " is-pending" : "")
            }
          >
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
