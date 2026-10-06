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

function hrefPath(href: string) {
  return href.split(/[?#]/)[0];
}

function currentLocationKey(pathname: string) {
  if (typeof window === "undefined") return pathname;
  return pathname + window.location.search + window.location.hash;
}

export function AppNav({
  items,
  orderSubItems = [],
  settingsSubItems = [],
  compact = false,
}: {
  items: readonly NavItem[];
  orderSubItems?: readonly SubItem[];
  settingsSubItems?: readonly SubItem[];
  compact?: boolean;
}) {
  const pathname = usePathname();
  const ordersActive = isItemActive(pathname, "/app/orders", "orders");
  const settingsActive = isItemActive(pathname, "/app/settings", "settings");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(ordersActive);
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  const [activeSubHref, setActiveSubHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);

    if (ordersActive && orderSubItems.length) {
      setOrdersOpen(true);
      setSettingsOpen(false);
    } else if (settingsActive && settingsSubItems.length) {
      setSettingsOpen(true);
      setOrdersOpen(false);
    }

    setActiveSubHref(currentLocationKey(pathname));
  }, [pathname, ordersActive, settingsActive, orderSubItems.length, settingsSubItems.length]);

  useEffect(() => {
    const syncHash = () => setActiveSubHref(currentLocationKey(pathname));
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/app/settings" || !settingsSubItems.length) return;

    const ids = ["company", "quote-settings", "brand", "business-central", "users"];
    let frame = 0;

    const syncSectionFromScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchorLine = Math.min(window.innerHeight * 0.34, 260);
        let activeId = ids[0];

        for (const id of ids) {
          const element = document.getElementById(id);
          if (!element) continue;
          const top = element.getBoundingClientRect().top;
          if (top <= anchorLine) activeId = id;
        }

        const nearBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 12;
        if (nearBottom) activeId = ids[ids.length - 1];

        setActiveSubHref(`/app/settings#${activeId}`);
      });
    };

    syncSectionFromScroll();
    window.addEventListener("scroll", syncSectionFromScroll, { passive: true });
    window.addEventListener("resize", syncSectionFromScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncSectionFromScroll);
      window.removeEventListener("resize", syncSectionFromScroll);
    };
  }, [pathname, settingsSubItems.length]);

  return (
    <nav className={"app-sidebar-v2-nav" + (compact ? " is-compact" : "")} aria-label="Application navigation">
      {items.map(([label, href, id]) => {
        const active = isItemActive(pathname, href, id);
        const pending = pendingHref === href && !active;
        const subItems =
          id === "orders"
            ? orderSubItems
            : id === "settings"
              ? settingsSubItems
              : [];
        const expandable = subItems.length > 0;
        const open = id === "orders" ? ordersOpen : settingsOpen;

        if (expandable) {
          return (
            <div
              key={href}
              className={
                "app-sidebar-v2-order-group" +
                (active ? " is-active" : "") +
                (open ? " is-open" : "")
              }
            >
              <div className="app-sidebar-v2-order-parent">
                <Link
                  href={href}
                  prefetch
                  onClick={() => {
                    setPendingHref(href);
                    setActiveSubHref(href);
                  }}
                  className={"app-sidebar-v2-link app-sidebar-v2-link-" + id}
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
                  aria-label={open ? `Collapse ${label} menu` : `Expand ${label} menu`}
                  aria-expanded={open}
                  onClick={() => {
                    if (id === "orders") {
                      setOrdersOpen((value) => {
                        const next = !value;
                        if (next) setSettingsOpen(false);
                        return next;
                      });
                    } else {
                      setSettingsOpen((value) => {
                        const next = !value;
                        if (next) setOrdersOpen(false);
                        return next;
                      });
                    }
                  }}
                >
                  <Chevron open={open} />
                </button>
              </div>

              <div className="app-sidebar-v2-subnav" hidden={!open}>
                {subItems.map(([subLabel, subHref]) => {
                  const targetPath = hrefPath(subHref);
                  const currentKey = activeSubHref || pathname;
                  let subActive = false;

                  if (id === "orders") {
                    subActive =
                      pathname === targetPath &&
                      (currentKey === subHref ||
                        (subHref === "/app/orders" &&
                          !currentKey.includes("?view=")));
                  } else if (id === "settings") {
                    if (subHref === "/app/memory") {
                      subActive = pathname === "/app/memory";
                    } else if (subHref === "/app/settings#business-central") {
                      subActive =
                        pathname.startsWith("/app/settings/business-central") ||
                        currentKey === subHref;
                    } else if (subHref === "/app/settings/support") {
                      subActive = pathname.startsWith("/app/settings/support");
                    } else {
                      subActive =
                        pathname === "/app/settings" &&
                        (currentKey === subHref ||
                          (subHref === "/app/settings#company" &&
                            !currentKey.includes("#")));
                    }
                  }

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
