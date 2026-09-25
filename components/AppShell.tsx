import Link from "next/link";
import { signOut } from "@/app/app/actions";

export function AppShell({
  children,
  workspaceName,
  workspaceRole,
  userEmail,
  leadAlertCount = 0,
}: {
  children: React.ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  leadAlertCount?: number;
}) {
  const showSales = workspaceRole === "owner" || workspaceRole === "admin";
  const nav = [
    ["Inbox", "/app/inbox"],
    ...(showSales ? [["Leads", "/app/leads"]] : []),
    ["Upload & process", "/app/upload"],
    ["Products", "/app/products"],
    ["Product memory", "/app/memory"],
  ] as const;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[#10251b] px-5 py-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:block">
          <div>
            <div className="text-xl font-extrabold tracking-[-0.03em]">Rivora</div>
            <div className="mt-1 text-xs text-white/55">RFQ intelligence desk</div>
          </div>
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/75">v0.2</div>
        </div>

        <nav className="mt-7 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {nav.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <span>{label}</span>
              {label === "Leads" && leadAlertCount > 0 ? (
                <span className="min-w-5 rounded-full bg-[#d5a667] px-1.5 py-0.5 text-center text-[10px] font-black text-[#2d2112]">
                  {leadAlertCount > 99 ? "99+" : leadAlertCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="mt-8 hidden rounded-xl border border-white/10 bg-white/5 p-4 lg:block">
          <div className="text-xs font-bold uppercase tracking-[.12em] text-white/45">Workspace</div>
          <div className="mt-2 text-sm font-bold">{workspaceName}</div>
          {userEmail ? <div className="mt-1 truncate text-xs text-white/45">{userEmail}</div> : null}
          <div className="mt-3 text-xs leading-5 text-white/55">
            CSV/XLSX → deterministic matching → human review → customer memory.
          </div>
          <form action={signOut}>
            <button className="mt-4 text-xs font-bold text-white/65 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
