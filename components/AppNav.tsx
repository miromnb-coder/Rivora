"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type NavItem = readonly [label: string, href: string, id: string, group: "main" | "process" | "manage"];

function isItemActive(pathname: string, href: string, id: string, view: string | null) {
  if (id === "dashboard") return pathname === "/app";
  if (id === "orders") return (pathname.startsWith("/app/orders") && !["attention", "erp"].includes(view ?? "")) || pathname.startsWith("/app/purchase-orders") || pathname.startsWith("/app/sales-orders") || pathname.startsWith("/app/quotes");
  if (id === "reviews") return pathname === "/app/orders" && view === "attention";
  if (id === "erp") return pathname === "/app/orders" && view === "erp";
  if (id === "rfq") return pathname.startsWith("/app/inbox") || pathname.startsWith("/app/rfq/") || pathname === "/app/upload";
  if (id === "settings") return pathname.startsWith("/app/settings") || pathname === "/app/memory" || pathname.startsWith("/app/memory/");
  if (["tasks", "team"].includes(id)) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavIcon({ id }: { id: string }) {
  const common = {
    width: 20,
    height: 20,
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
        <path d="m3.5 10 8.5-7 8.5 7v9.2a1.3 1.3 0 0 1-1.3 1.3h-4.4v-7h-5.6v7H4.8a1.3 1.3 0 0 1-1.3-1.3Z" />
      </svg>
    );
  }

  if (["orders", "rfq", "quotes"].includes(id)) {
    return (
      <svg {...common}>
        <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M14 3.5V8h4M8 12h7M8 16h7" />
      </svg>
    );
  }

  if (id === "products") {
    return (
      <svg {...common}>
        <path d="m12 2.7 8 4.5v9.6l-8 4.5-8-4.5V7.2Z" />
        <path d="m4.2 7.3 7.8 4.6 7.8-4.6M12 11.9v9.2" />
      </svg>
    );
  }

  if (["customers", "team"].includes(id)) {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M6.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5" />
      </svg>
    );
  }

  if (id === "reviews") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7L16 9" />
      </svg>
    );
  }
  if (id === "erp") return <svg {...common}><path d="M20 7V3l-3 3a8 8 0 0 0-13 4M4 17v4l3-3a8 8 0 0 0 13-4" /><path d="M20 3v5h-5M4 21v-5h5" /></svg>;
  if (id === "tasks") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
  if (id === "leads") return <svg {...common}><path d="M5 6h14M5 11h12M5 16h8" /><circle cx="17" cy="17" r="2" /></svg>;

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.2 12c0-.5 0-.9-.1-1.3l1.8-1.4-1.9-3.2-2.2.9a7.6 7.6 0 0 0-2.3-1.3L14.2 3h-4.4l-.3 2.7A7.6 7.6 0 0 0 7.2 7L5 6.1 3.1 9.3l1.8 1.4A8.3 8.3 0 0 0 4.8 12c0 .5 0 .9.1 1.3l-1.8 1.4L5 17.9l2.2-.9a7.6 7.6 0 0 0 2.3 1.3l.3 2.7h4.4l.3-2.7a7.6 7.6 0 0 0 2.3-1.3l2.2.9 1.9-3.2-1.8-1.4c.1-.4.1-.8.1-1.3Z" />
    </svg>
  );
}

export function AppNav({ items, compact = false, collapsed = false, locale = "fi" }: {
  items: readonly NavItem[];
  compact?: boolean;
  collapsed?: boolean;
  locale?: "fi" | "en";
}) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => { setPendingHref(null); }, [pathname, view]);
  const visible = compact ? items.filter(([, , id]) => ["dashboard", "orders", "rfq", "products", "customers"].includes(id)) : items;
  let lastGroup = "";
  return (
    <nav className={"app-sidebar-v2-nav" + (compact ? " is-compact" : "")}
      aria-label={locale === "fi" ? "Sovelluksen päävalikko" : "Application main navigation"}>
      {visible.map(([label, href, id, group]) => {
        const groupHeading = !compact && group !== lastGroup ? (group === "process" ? (locale === "fi" ? "Prosessit" : "Processes") : group === "manage" ? (locale === "fi" ? "Hallinta" : "Manage") : (locale === "fi" ? "Päänavigaatio" : "Main navigation")) : null;
        lastGroup = group;
        const active = compact && id === "orders" && pathname.startsWith("/app/orders") ? true : isItemActive(pathname, href, id, view);
        const pending = pendingHref === href && !active;
        return (
          <div className="app-nav-entry" key={id}>
          {groupHeading ? <div className="app-nav-group-title">{groupHeading}</div> : null}
          <Link href={href} prefetch
            title={collapsed && !compact ? label : undefined}
            aria-label={collapsed && !compact ? label : undefined}
            onClick={() => { if (href.split(/[?#]/)[0] !== pathname || href.includes("?")) setPendingHref(href); }}
            aria-current={active ? "page" : undefined}
            aria-busy={pending || undefined}
            className={"app-sidebar-v2-link app-sidebar-v2-link-" + id +
              (active ? " is-active" : "") + (pending ? " is-pending" : "")}>
            <span className="app-nav-main">
              <span className="app-nav-icon"><NavIcon id={id} /></span>
              <span className="app-nav-label">{label}</span>
            </span>
            {pending ? <span className="app-nav-pending-dot" aria-hidden="true" /> : null}
          </Link>
          </div>
        );
      })}
    </nav>
  );
}
