import Link from "next/link";

const nav = [
  ["Inbox", "/app/inbox"],
  ["Upload RFQ", "/app/upload"],
  ["Products", "/app/products"],
  ["Product memory", "/app/memory"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[#10251b] px-5 py-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:block">
          <div>
            <div className="text-xl font-extrabold tracking-[-0.03em]">Rivora</div>
            <div className="mt-1 text-xs text-white/55">RFQ intelligence desk</div>
          </div>
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/75">v0.1</div>
        </div>
        <nav className="mt-7 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 hidden rounded-xl border border-white/10 bg-white/5 p-4 lg:block">
          <div className="text-xs font-bold uppercase tracking-[.12em] text-white/45">Workspace</div>
          <div className="mt-2 text-sm font-bold">Demo Industrial Oy</div>
          <div className="mt-1 text-xs leading-5 text-white/55">Human review stays in control. ERP write-back is intentionally off.</div>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
