import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { formatLocale, getLocale } from "@/lib/locale";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizedKey(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join("::");
}

type Task = {
  key: string;
  caseKey: string;
  stageRank: number;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  priority: number;
  updatedAt: string;
};

export default async function AppHome() {
  const [{ supabase, workspace }, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);

  const [
    { data: organization },
    { count: productCount },
    { count: rfqCount },
    { count: quoteCount },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("name,email,address_line1,city")
      .eq("id", workspace.id)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .eq("active", true),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id),
  ]);

  const companyReady = Boolean(
    organization?.name &&
      organization?.email &&
      organization?.address_line1 &&
      organization?.city,
  );
  const setupComplete =
    companyReady &&
    (productCount ?? 0) > 0 &&
    (rfqCount ?? 0) > 0 &&
    (quoteCount ?? 0) > 0;

  if (!setupComplete) redirect("/app/setup");

  const [
    { data: rfqs },
    { data: quotes },
    { data: purchaseOrders },
    { data: salesOrders },
  ] = await Promise.all([
    supabase
      .from("rfqs")
      .select("id,reference,status,received_at,customers(name)")
      .eq("organization_id", workspace.id)
      .order("received_at", { ascending: false })
      .limit(40),
    supabase
      .from("quotes")
      .select("id,quote_number,status,currency,updated_at,customers(name),rfqs(reference),quote_lines(line_total)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("purchase_orders")
      .select("id,po_number,status,updated_at,customers(name),quotes(quote_number)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("sales_order_drafts")
      .select("id,status,customer_po_number,updated_at,customers(name),quotes(quote_number),purchase_orders(po_number),sales_order_draft_lines(line_total)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const tasks: Task[] = [];

  for (const rfq of rfqs ?? []) {
    if (rfq.status !== "needs_review") continue;
    const customer = relationOne<any>((rfq as any).customers);
    const customerName = customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer");
    const reference = rfq.reference || "RFQ";
    tasks.push({
      key: `rfq-${rfq.id}`,
      caseKey: normalizedKey(customerName, reference),
      stageRank: 1,
      eyebrow: fi ? "Tarjouspyyntö" : "RFQ",
      title: fi ? "Tarjouspyyntö odottaa tarkistusta" : "RFQ needs review",
      detail: `${customerName} · ${reference}`,
      href: `/app/orders/case/rfq/${rfq.id}`,
      action: fi ? "Tarkista tarjouspyyntö" : "Review RFQ",
      priority: 10,
      updatedAt: rfq.received_at,
    });
  }

  for (const quote of quotes ?? []) {
    if (!["draft", "ready", "approved"].includes(String(quote.status))) continue;
    const customer = relationOne<any>((quote as any).customers);
    const rfq = relationOne<any>((quote as any).rfqs);
    const lines = Array.isArray((quote as any).quote_lines) ? (quote as any).quote_lines : [];
    const total = lines.reduce((sum: number, line: any) => sum + Number(line.line_total ?? 0), 0);
    const money = new Intl.NumberFormat(displayLocale, {
      style: "currency",
      currency: quote.currency || "EUR",
    });
    const state =
      quote.status === "draft"
        ? {
            title: fi ? "Tarjous on kesken" : "Quote is in progress",
            action: fi ? "Viimeistele tarjous" : "Finish quote",
            priority: 7,
          }
        : quote.status === "ready"
          ? {
              title: fi ? "Tarjous odottaa hyväksyntää" : "Quote awaits approval",
              action: fi ? "Hyväksy tarjous" : "Approve quote",
              priority: 9,
            }
          : {
              title: fi ? "Hyväksytty tarjous on valmis lähetettäväksi" : "Approved quote is ready to send",
              action: fi ? "Lähetä tarjous" : "Send quote",
              priority: 8,
            };

    const customerName = customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer");
    const reference = rfq?.reference || quote.quote_number || "Quote";
    tasks.push({
      key: `quote-${quote.id}`,
      caseKey: normalizedKey(customerName, reference),
      stageRank: 2,
      eyebrow: fi ? "Tarjous" : "Quote",
      title: state.title,
      detail: `${customerName} · ${reference} · ${money.format(total)}`,
      href: `/app/orders/case/quote/${quote.id}`,
      action: state.action,
      priority: state.priority,
      updatedAt: quote.updated_at,
    });
  }

  for (const po of purchaseOrders ?? []) {
    if (!["extracted", "needs_review", "matched"].includes(String(po.status))) continue;
    const customer = relationOne<any>((po as any).customers);
    const quote = relationOne<any>((po as any).quotes);
    const state =
      po.status === "matched"
        ? {
            title: fi ? "Asiakkaan tilaus täsmää tarjoukseen" : "Customer order matches the quote",
            action: fi ? "Hyväksy tilaus" : "Approve order",
            priority: 10,
          }
        : {
            title: fi ? "Asiakkaan tilaus pitää tarkistaa" : "Customer order needs review",
            action: fi ? "Tarkista tilaus" : "Review order",
            priority: 11,
          };

    const customerName = customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer");
    const reference = quote?.quote_number || po.po_number || "PO";
    tasks.push({
      key: `po-${po.id}`,
      caseKey: normalizedKey(customerName, reference),
      stageRank: 3,
      eyebrow: fi ? "Ostotilaus" : "Purchase order",
      title: state.title,
      detail: `${customerName} · ${po.po_number || "PO"}${quote?.quote_number ? ` · ${quote.quote_number}` : ""}`,
      href: `/app/orders/case/po/${po.id}`,
      action: state.action,
      priority: state.priority,
      updatedAt: po.updated_at,
    });
  }

  for (const order of salesOrders ?? []) {
    if (!["draft", "erp_failed"].includes(String(order.status))) continue;
    const customer = relationOne<any>((order as any).customers);
    const lines = Array.isArray((order as any).sales_order_draft_lines)
      ? (order as any).sales_order_draft_lines
      : [];
    const total = lines.reduce((sum: number, line: any) => sum + Number(line.line_total ?? 0), 0);
    const money = new Intl.NumberFormat(displayLocale, {
      style: "currency",
      currency: "EUR",
    });

    const customerName = customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer");
    const reference = order.customer_po_number || "PO";
    tasks.push({
      key: `sales-${order.id}`,
      caseKey: normalizedKey(customerName, reference),
      stageRank: 4,
      eyebrow: "Business Central",
      title:
        order.status === "erp_failed"
          ? fi
            ? "ERP-vienti vaatii huomiota"
            : "ERP export needs attention"
          : fi
            ? "Tilaus on valmis Business Centraliin"
            : "Order is ready for Business Central",
      detail: `${customerName} · ${reference} · ${money.format(total)}`,
      href: `/app/orders/case/sales/${order.id}`,
      action: order.status === "erp_failed"
        ? fi ? "Tarkista ERP-vienti" : "Review ERP export"
        : fi ? "Luo myyntitilaus" : "Create sales order",
      priority: 12,
      updatedAt: order.updated_at,
    });
  }

  const taskCases = new Map<string, Task>();
  for (const task of tasks) {
    const existing = taskCases.get(task.caseKey);
    if (
      !existing ||
      task.stageRank > existing.stageRank ||
      (task.stageRank === existing.stageRank &&
        (task.priority > existing.priority ||
          new Date(task.updatedAt).getTime() > new Date(existing.updatedAt).getTime()))
    ) {
      taskCases.set(task.caseKey, task);
    }
  }

  const dedupedTasks = [...taskCases.values()].sort(
    (a, b) =>
      b.priority - a.priority ||
      b.stageRank - a.stageRank ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const attention = dedupedTasks.slice(0, 4);

  const uniqueCount = (items: any[], keyFor: (item: any) => string, include: (item: any) => boolean) =>
    new Set(items.filter(include).map(keyFor).filter(Boolean)).size;

  const openRfqs = uniqueCount(
    rfqs ?? [],
    (item) => normalizedKey(relationOne<any>(item.customers)?.name, item.reference || item.id),
    (item) => !["ready", "quoted"].includes(String(item.status)),
  );
  const sentQuotes = uniqueCount(
    quotes ?? [],
    (item) => normalizedKey(relationOne<any>(item.customers)?.name, relationOne<any>(item.rfqs)?.reference || item.quote_number || item.id),
    (item) => item.status === "sent",
  );
  const activePos = uniqueCount(
    purchaseOrders ?? [],
    (item) => normalizedKey(relationOne<any>(item.customers)?.name, item.po_number || item.id),
    (item) => !["erp_created", "failed"].includes(String(item.status)),
  );
  const erpReady = uniqueCount(
    salesOrders ?? [],
    (item) => normalizedKey(relationOne<any>(item.customers)?.name, item.customer_po_number || item.id),
    (item) => ["draft", "erp_failed"].includes(String(item.status)),
  );

  const recentCandidates = [
    ...(salesOrders ?? []).slice(0, 8).map((item: any) => ({
      key: `sales-${item.id}`,
      caseKey: normalizedKey(
        relationOne<any>(item.customers)?.name,
        item.customer_po_number || relationOne<any>(item.purchase_orders)?.po_number || item.id,
      ),
      stageRank: 4,
      customer: relationOne<any>(item.customers)?.name || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      reference: item.customer_po_number || relationOne<any>(item.purchase_orders)?.po_number || "Sales order",
      stage: item.status === "erp_created" ? (fi ? "Valmis" : "Complete") : "ERP",
      href: `/app/orders/case/sales/${item.id}`,
      updatedAt: item.updated_at,
    })),
    ...(purchaseOrders ?? []).slice(0, 8).map((item: any) => ({
      key: `po-${item.id}`,
      caseKey: normalizedKey(
        relationOne<any>(item.customers)?.name,
        item.po_number || item.id,
      ),
      stageRank: 3,
      customer: relationOne<any>(item.customers)?.name || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      reference: item.po_number || "PO",
      stage: fi ? "Ostotilaus" : "Purchase order",
      href: `/app/orders/case/po/${item.id}`,
      updatedAt: item.updated_at,
    })),
    ...(quotes ?? []).slice(0, 8).map((item: any) => ({
      key: `quote-${item.id}`,
      caseKey: normalizedKey(
        relationOne<any>(item.customers)?.name,
        relationOne<any>(item.rfqs)?.reference || item.quote_number || item.id,
      ),
      stageRank: 2,
      customer: relationOne<any>(item.customers)?.name || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      reference: item.quote_number || relationOne<any>(item.rfqs)?.reference || "Quote",
      stage: fi ? "Tarjous" : "Quote",
      href: `/app/orders/case/quote/${item.id}`,
      updatedAt: item.updated_at,
    })),
  ];

  const recentMap = new Map<string, (typeof recentCandidates)[number]>();
  for (const item of recentCandidates) {
    const existing = recentMap.get(item.caseKey);
    if (
      !existing ||
      item.stageRank > existing.stageRank ||
      (item.stageRank === existing.stageRank &&
        new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime())
    ) {
      recentMap.set(item.caseKey, item);
    }
  }

  const recentCases = [...recentMap.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className="app-page-v2">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="app-kicker-v2">{fi ? "Työpöytä" : "Workspace"}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#202320] md:text-4xl">
              {fi ? "Vaatii huomiota" : "Needs attention"}
            </h1>
            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#f1f2ef] px-2.5 py-1 text-sm font-bold text-[#343834]">
              {dedupedTasks.length}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Näet ensin caset, jotka tarvitsevat päätöksen juuri nyt."
              : "Averomira puts the work needing a human decision first. Everything else stays in the background."}
          </p>
        </div>
        <Link href="/app/upload" className="upload-v2-primary-btn">
          + {fi ? "Uusi tarjouspyyntö" : "New RFQ"}
        </Link>
      </header>

      <section className="mt-7 grid gap-2 md:grid-cols-4">
        {[
          [fi ? "Avoimet RFQ:t" : "Open RFQs", openRfqs],
          [fi ? "Lähetetyt tarjoukset" : "Sent quotes", sentQuotes],
          [fi ? "Aktiiviset PO:t" : "Active POs", activePos],
          [fi ? "ERP-toimet" : "ERP actions", erpReady],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
            <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
            <strong className="mt-1.5 block text-xl font-semibold">{value}</strong>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">
              {fi ? "Seuraavat tehtävät" : "Next tasks"}
            </h2>
          </div>
          <Link href="/app/orders?view=attention" className="text-sm font-semibold">
            {fi ? "Näytä kaikki" : "View all"} →
          </Link>
        </div>

        {attention.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
            {attention.map((task) => (
              <Link
                key={task.key}
                href={task.href}
                className="group grid gap-3 px-5 py-4 transition hover:bg-[#fafaf8] md:grid-cols-[120px_minmax(0,1fr)_190px_24px] md:items-center"
              >
                <span className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">
                  {task.eyebrow}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-[-0.015em]">{task.title}</h3>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{task.detail}</p>
                </div>
                <div className="text-sm font-semibold">{task.action}</div>
                <span className="text-base transition group-hover:translate-x-1">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-[var(--line)] bg-white p-8">
            <strong>{fi ? "Ei kiireellisiä tehtäviä." : "No urgent tasks."}</strong>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {fi ? "Voit aloittaa uuden tarjouspyynnön tai avata kaikki tilaukset." : "Start a new RFQ or open all orders."}
            </p>
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">
              {fi ? "Viimeisimmät tilauscaset" : "Recent order cases"}
            </h2>
          </div>
          <Link href="/app/orders" className="text-sm font-semibold">
            {fi ? "Kaikki tilaukset" : "All orders"} →
          </Link>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {recentCases.length ? recentCases.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="grid gap-2 px-5 py-4 transition hover:bg-[#fafaf8] md:grid-cols-[1.4fr_1fr_.7fr_auto] md:items-center"
            >
              <strong>{item.customer}</strong>
              <span className="text-sm text-[var(--muted)]">{item.reference}</span>
              <span className="text-sm font-semibold">{item.stage}</span>
              <span className="text-sm font-semibold">
                {new Date(item.updatedAt).toLocaleDateString(displayLocale)} →
              </span>
            </Link>
          )) : (
            <div className="p-8 text-sm text-[var(--muted)]">
              {fi ? "Tilauksia ei ole vielä." : "No orders yet."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
