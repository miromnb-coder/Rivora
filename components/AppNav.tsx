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
      pathname.startsWith("/app/sales-orders")
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={open ? "is-open" : ""}
    >
      <path d="m6 8 4 4 4-4" />
    </svg>
  );
}

export function AppNav({
  items,
  orderSubItems = [],
  compact = false,
}: {
  items: readonly NavItem[];
  orderSubItems?: readonly SubItem[];
  compact?: boolean;
}) {
  const pathname = usePathname();
  const ordersActive = isItemActive(pathname, "/app/orders", "orders");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(ordersActive);
  const [activeSubHref, setActiveSubHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
    if (ordersActive && orderSubItems.length) setOrdersOpen(true);

    if (typeof window !== "undefined" && pathname === "/app/orders") {
      setActiveSubHref(pathname + window.location.search);
    } else {
      setActiveSubHref(null);
    }
  }, [pathname, ordersActive, orderSubItems.length]);

  return (
    <nav className={"app-sidebar-v2-nav" + (compact ? " is-compact" : "")} aria-label="Application navigation">
      {items.map(([label, href, id]) => {
        const active = isItemActive(pathname, href, id);
        const pending = pendingHref === href && !active;
        const expandable = id === "orders" && orderSubItems.length > 0;

        if (expandable) {
          return (
            <div
              key={href}
              className={
                "app-sidebar-v2-order-group" +
                (active ? " is-active" : "") +
                (ordersOpen ? " is-open" : "")
              }
            >
              <div className="app-sidebar-v2-order-parent">
                <Link
                  href={href}
                  prefetch
                  onClick={() => {
                    setPendingHref(href);
                    setActiveSubHref("/app/orders");
                  }}
                  className="app-sidebar-v2-link app-sidebar-v2-link-orders"
                >
                  <span className="app-nav-main">
                    <span className="app-nav-icon"><NavIcon id={id} /></span>
                    <span className="app-nav-label">{label}</span>
                  </span>
                  {pending ? <span className="app-nav-pending-dot" aria-hidden="true" /> : null}
                </Link>
                <button
                  type="button"
                  className="app-sidebar-v2-chevron"
                  aria-label={ordersOpen ? "Collapse orders menu" : "Expand orders menu"}
                  aria-expanded={ordersOpen}
                  onClick={() => setOrdersOpen((value) => !value)}
                >
                  <Chevron open={ordersOpen} />
                </button>
              </div>

              <div className="app-sidebar-v2-subnav" hidden={!ordersOpen}>
                {orderSubItems.map(([subLabel, subHref]) => {
                  const subActive =
                    pathname === "/app/orders" &&
                    (activeSubHref === subHref ||
                      (!activeSubHref && subHref === "/app/orders"));

                  return (
                    <Link
                      key={subHref}
                      href={subHref}
                      prefetch
                      onClick={() => {
                        setPendingHref(subHref);
                        setActiveSubHref(subHref);
                      }}
                      aria-current={subActive ? "page" : undefined}
                      className={"app-sidebar-v2-sublink" + (subActive ? " is-active" : "")}
                    >
                      <span>{subLabel}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }

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
