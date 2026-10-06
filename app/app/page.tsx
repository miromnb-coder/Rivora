import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { formatLocale, getLocale } from "@/lib/locale";
import {
  businessCentralMappingIsVerified,
  getBusinessCentralConfigurationStatus,
} from "@/lib/rivora/erp/business-central";

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
    { data: erpMappings },
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
      .select("id,status,customer_id,customer_po_number,updated_at,customers(name),quotes(quote_number),purchase_orders(po_number),sales_order_draft_lines(line_total,product_id)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("erp_entity_mappings")
      .select("entity_type,local_entity_id,external_id,external_number,metadata")
      .eq("organization_id", workspace.id)
      .eq("provider", "business_central"),
  ]);

  const tasks: Task[] = [];
  const bcConfig = await getBusinessCentralConfigurationStatus(workspace.id);
  const erpMappingByEntity = new Map(
    (erpMappings ?? []).map((mapping: any) => [
      `${mapping.entity_type}:${mapping.local_entity_id}`,
      mapping,
    ]),
  );

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
    const productIds = [...new Set(lines.map((line: any) => String(line.product_id)).filter(Boolean))];
    const customerVerified = businessCentralMappingIsVerified(
      erpMappingByEntity.get(`customer:${order.customer_id}`) as any,
    );
    const missingProducts = productIds.filter(
      (productId) =>
        !businessCentralMappingIsVerified(
          erpMappingByEntity.get(`product:${productId}`) as any,
        ),
    );
    const missingMappings = (customerVerified ? 0 : 1) + missingProducts.length;
    const mappingTotal = 1 + productIds.length;
    const exportReady = bcConfig.configured && missingMappings === 0;

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
          : exportReady
            ? fi
              ? "Tilaus on valmis Business Centraliin"
              : "Order is ready for Business Central"
            : fi
              ? "Täydennä Business Central -vastineet"
              : "Complete Business Central mappings",
      detail:
        order.status === "draft" && !exportReady
          ? `${customerName} · ${reference} · ${money.format(total)} · ${missingMappings}/${mappingTotal} ${fi ? "vastinetta puuttuu" : "mappings missing"}`
          : `${customerName} · ${reference} · ${money.format(total)}`,
      href: `/app/orders/case/sales/${order.id}`,
      action: order.status === "erp_failed"
        ? fi ? "Tarkista ERP-vienti" : "Review ERP export"
        : exportReady
          ? fi ? "Luo myyntitilaus" : "Create sales order"
          : fi ? "Täydennä vastineet" : "Complete mappings",
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
    <div className="app-page-v2 dashboard-page">
      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="app-kicker-v2">{fi ? "Työpöytä" : "Workspace"}</div>
          <div className="dashboard-title-row">
            <h1>{fi ? "Vaatii huomiota" : "Needs attention"}</h1>
            <span className="dashboard-attention-count" aria-label={fi ? `${dedupedTasks.length} huomiota vaativaa casea` : `${dedupedTasks.length} cases need attention`}>
              {dedupedTasks.length}
            </span>
          </div>
          <p>
            {fi
              ? "Näet ensin caset, jotka tarvitsevat päätöksen juuri nyt."
              : "Averomira puts the work needing a human decision first. Everything else stays in the background."}
          </p>
        </div>

        <Link href="/app/upload" className="upload-v2-primary-btn dashboard-primary-cta">
          <span aria-hidden="true">+</span>
          {fi ? "Uusi tarjouspyyntö" : "New RFQ"}
        </Link>
      </header>

      <section className="dashboard-section dashboard-attention-section" aria-labelledby="dashboard-tasks-heading">
        <div className="dashboard-section-head">
          <div>
            <div className="dashboard-section-eyebrow">{fi ? "Työjono" : "Work queue"}</div>
            <h2 id="dashboard-tasks-heading">{fi ? "Seuraavat tehtävät" : "Next tasks"}</h2>
          </div>
          <Link href="/app/orders?view=attention" className="dashboard-text-link">
            {fi ? "Näytä kaikki" : "View all"} <span aria-hidden="true">→</span>
          </Link>
        </div>

        {attention.length ? (
          <div className="dashboard-attention-list">
            {attention.map((task, index) => (
              <Link
                key={task.key}
                href={task.href}
                className={"dashboard-task-row" + (index === 0 ? " is-primary" : "")}
              >
                <div className="dashboard-task-kind">{task.eyebrow}</div>
                <div className="dashboard-task-copy">
                  <h3>{task.title}</h3>
                  <p>{task.detail}</p>
                </div>
                <div className="dashboard-task-action">
                  <span>{task.action}</span>
                  <span className="dashboard-row-arrow" aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <strong>{fi ? "Ei kiireellisiä tehtäviä." : "No urgent tasks."}</strong>
            <p>
              {fi
                ? "Voit aloittaa uuden tarjouspyynnön tai avata kaikki tilaukset."
                : "Start a new RFQ or open all orders."}
            </p>
          </div>
        )}
      </section>

      <section className="dashboard-section dashboard-status-section" aria-labelledby="dashboard-status-heading">
        <div className="dashboard-section-head dashboard-section-head-compact">
          <div>
            <div className="dashboard-section-eyebrow">{fi ? "Yhteenveto" : "Overview"}</div>
            <h2 id="dashboard-status-heading">{fi ? "Tilanne nyt" : "Current status"}</h2>
          </div>
        </div>

        <div className="dashboard-kpi-strip">
          {[
            [fi ? "Avoimet RFQ:t" : "Open RFQs", openRfqs],
            [fi ? "Lähetetyt tarjoukset" : "Sent quotes", sentQuotes],
            [fi ? "Aktiiviset PO:t" : "Active POs", activePos],
            [fi ? "ERP-toimet" : "ERP actions", erpReady],
          ].map(([label, value]) => (
            <div key={String(label)} className="dashboard-kpi-item">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-section dashboard-recent-section" aria-labelledby="dashboard-recent-heading">
        <div className="dashboard-section-head">
          <div>
            <div className="dashboard-section-eyebrow">{fi ? "Historia" : "History"}</div>
            <h2 id="dashboard-recent-heading">
              {fi ? "Viimeisimmät tilauscaset" : "Recent order cases"}
            </h2>
          </div>
          <Link href="/app/orders" className="dashboard-text-link">
            {fi ? "Kaikki tilaukset" : "All orders"} <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="dashboard-recent-list">
          {recentCases.length ? recentCases.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="dashboard-recent-row"
            >
              <div className="dashboard-recent-identity">
                <strong>{item.customer}</strong>
                <span>{item.reference}</span>
              </div>
              <span className="dashboard-recent-stage">{item.stage}</span>
              <div className="dashboard-recent-meta">
                <span>{new Date(item.updatedAt).toLocaleDateString(displayLocale)}</span>
                <span className="dashboard-row-arrow" aria-hidden="true">→</span>
              </div>
            </Link>
          )) : (
            <div className="dashboard-empty-state dashboard-empty-state-plain">
              {fi ? "Tilauksia ei ole vielä." : "No orders yet."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
