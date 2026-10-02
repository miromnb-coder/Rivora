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
            <span>{label}</span>
            {pending ? <span className="app-nav-pending-dot" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
