import Link from "next/link";
import { notFound } from "next/navigation";
import { formatLocale, getLocale } from "@/lib/locale";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  businessCentralMappingIsVerified,
  getBusinessCentralConfigurationStatus,
} from "@/lib/rivora/erp/business-central";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function money(locale: string, currency: string, value: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "EUR",
  }).format(value);
}

function stageState(done: boolean, current: boolean) {
  return done ? "done" : current ? "current" : "future";
}

function caseStatusLabel(status: string, fi: boolean) {
  const labels: Record<string, string> = fi
    ? {
        processing: "Käsittelyssä",
        needs_review: "Vaatii tarkistuksen",
        ready: "Valmis",
        draft: "Luonnos",
        approved: "Hyväksytty",
        sent: "Lähetetty",
        extracted: "Poimittu",
        matched: "Täsmää",
        ready_for_erp: "Valmis ERP:iin",
        erp_pending: "Viedään ERP:iin",
        erp_created: "Luotu ERP:iin",
        erp_partial: "ERP-tarkistus",
        erp_failed: "ERP-vienti epäonnistui",
        failed: "Epäonnistui",
      }
    : {
        processing: "Processing",
        needs_review: "Needs review",
        ready: "Ready",
        draft: "Draft",
        approved: "Approved",
        sent: "Sent",
        extracted: "Extracted",
        matched: "Matched",
        ready_for_erp: "Ready for ERP",
        erp_pending: "Sending to ERP",
        erp_created: "Created in ERP",
        erp_partial: "ERP review",
        erp_failed: "ERP export failed",
        failed: "Failed",
      };

  return labels[status] || status.replaceAll("_", " ");
}

export default async function OrderCasePage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const [{ kind, id }, locale, context] = await Promise.all([
    params,
    getLocale(),
    requireWorkspace(),
  ]);

  if (!["rfq", "quote", "po", "sales"].includes(kind)) notFound();

  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);

  let rfqId: string | null = null;
  let quoteId: string | null = null;
  let purchaseOrderId: string | null = null;
  let salesOrderId: string | null = null;

  if (kind === "rfq") {
    const { data } = await supabase
      .from("rfqs")
      .select("id")
      .eq("id", id)
      .eq("organization_id", workspace.id)
      .maybeSingle();
    if (!data) notFound();
    rfqId = String(data.id);
  }

  if (kind === "quote") {
    const { data } = await supabase
      .from("quotes")
      .select("id,rfq_id")
      .eq("id", id)
      .eq("organization_id", workspace.id)
      .maybeSingle();
    if (!data) notFound();
    quoteId = String(data.id);
    rfqId = data.rfq_id ? String(data.rfq_id) : null;
  }

  if (kind === "po") {
    const { data } = await supabase
      .from("purchase_orders")
      .select("id,quote_id")
      .eq("id", id)
      .eq("organization_id", workspace.id)
      .maybeSingle();
    if (!data) notFound();
    purchaseOrderId = String(data.id);
    quoteId = data.quote_id ? String(data.quote_id) : null;
  }

  if (kind === "sales") {
    const { data } = await supabase
      .from("sales_order_drafts")
      .select("id,purchase_order_id,quote_id")
      .eq("id", id)
      .eq("organization_id", workspace.id)
      .maybeSingle();
    if (!data) notFound();
    salesOrderId = String(data.id);
    purchaseOrderId = data.purchase_order_id ? String(data.purchase_order_id) : null;
    quoteId = data.quote_id ? String(data.quote_id) : null;
  }

  if (quoteId && !rfqId) {
    const { data } = await supabase
      .from("quotes")
      .select("rfq_id")
      .eq("id", quoteId)
      .eq("organization_id", workspace.id)
      .maybeSingle();
    rfqId = data?.rfq_id ? String(data.rfq_id) : null;
  }

  if (rfqId && !quoteId) {
    const { data } = await supabase
      .from("quotes")
      .select("id")
      .eq("rfq_id", rfqId)
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    quoteId = data?.id ? String(data.id) : null;
  }

  if (quoteId && !purchaseOrderId) {
    const { data } = await supabase
      .from("purchase_orders")
      .select("id")
      .eq("quote_id", quoteId)
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    purchaseOrderId = data?.id ? String(data.id) : null;
  }

  if (purchaseOrderId && !salesOrderId) {
    const { data } = await supabase
      .from("sales_order_drafts")
      .select("id")
      .eq("purchase_order_id", purchaseOrderId)
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    salesOrderId = data?.id ? String(data.id) : null;
  }

  const [rfqResult, quoteResult, poResult, salesResult] = await Promise.all([
    rfqId
      ? supabase
          .from("rfqs")
          .select("id,reference,status,received_at,overall_confidence,customers(name),rfq_lines(count)")
          .eq("id", rfqId)
          .eq("organization_id", workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    quoteId
      ? supabase
          .from("quotes")
          .select("id,quote_number,status,currency,updated_at,valid_until,customers(name),quote_lines(line_total)")
          .eq("id", quoteId)
          .eq("organization_id", workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    purchaseOrderId
      ? supabase
          .from("purchase_orders")
          .select("id,po_number,status,currency,order_date,updated_at,source_type,customers(name),purchase_order_lines(count)")
          .eq("id", purchaseOrderId)
          .eq("organization_id", workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    salesOrderId
      ? supabase
          .from("sales_order_drafts")
          .select("id,status,customer_id,customer_po_number,currency,updated_at,external_order_number,erp_error,sales_order_draft_lines(line_total,product_id)")
          .eq("id", salesOrderId)
          .eq("organization_id", workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rfq = rfqResult.data as any;
  const quote = quoteResult.data as any;
  const po = poResult.data as any;
  const sales = salesResult.data as any;

  let reconciliation: any = null;
  let exceptionCount = 0;
  if (purchaseOrderId) {
    const { data } = await supabase
      .from("purchase_order_reconciliations")
      .select("id,status,run_number,summary,header_exceptions,created_at")
      .eq("purchase_order_id", purchaseOrderId)
      .eq("organization_id", workspace.id)
      .order("run_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    reconciliation = data;

    if (reconciliation?.id) {
      const { count } = await supabase
        .from("purchase_order_reconciliation_lines")
        .select("id", { count: "exact", head: true })
        .eq("reconciliation_id", reconciliation.id)
        .eq("review_status", "open");
      const headerOpen = Array.isArray(reconciliation.header_exceptions)
        ? reconciliation.header_exceptions.length
        : 0;
      exceptionCount = Number(count ?? 0) + headerOpen;
    }
  }

  const customer =
    relationOne<any>(sales?.customers)?.name ||
    relationOne<any>(po?.customers)?.name ||
    relationOne<any>(quote?.customers)?.name ||
    relationOne<any>(rfq?.customers)?.name ||
    (fi ? "Tuntematon asiakas" : "Unknown customer");

  const quoteLines = Array.isArray(quote?.quote_lines) ? quote.quote_lines : [];
  const quoteTotal = quoteLines.reduce(
    (sum: number, line: any) => sum + Number(line.line_total ?? 0),
    0,
  );
  const salesLines = Array.isArray(sales?.sales_order_draft_lines)
    ? sales.sales_order_draft_lines
    : [];
  const salesTotal = salesLines.reduce(
    (sum: number, line: any) => sum + Number(line.line_total ?? 0),
    0,
  );
  const total = salesTotal || quoteTotal;
  const currency = sales?.currency || po?.currency || quote?.currency || "EUR";

  let bcExportReady = false;
  let bcMissingMappings = 0;
  let bcMappingTotal = 0;

  if (sales?.status === "draft") {
    const productIds = [
      ...new Set(
        salesLines
          .map((line: any) => String(line.product_id || ""))
          .filter(Boolean),
      ),
    ];

    const { data: mappings } = await supabase
      .from("erp_entity_mappings")
      .select("entity_type,local_entity_id,external_id,external_number,metadata")
      .eq("organization_id", workspace.id)
      .eq("provider", "business_central");

    const byEntity = new Map(
      (mappings ?? []).map((mapping: any) => [
        `${mapping.entity_type}:${mapping.local_entity_id}`,
        mapping,
      ]),
    );

    const customerVerified = businessCentralMappingIsVerified(
      byEntity.get(`customer:${sales.customer_id}`) as any,
    );
    const missingProducts = productIds.filter(
      (productId) =>
        !businessCentralMappingIsVerified(
          byEntity.get(`product:${productId}`) as any,
        ),
    );

    bcMappingTotal = 1 + productIds.length;
    bcMissingMappings = (customerVerified ? 0 : 1) + missingProducts.length;
    const bcConfig = await getBusinessCentralConfigurationStatus(workspace.id);
    bcExportReady = bcConfig.configured && bcMissingMappings === 0;
  }

  const currentStage = sales ? "erp" : po ? "po" : quote ? "quote" : "rfq";

  const rfqDone = Boolean(rfq && !["processing", "failed", "needs_review"].includes(String(rfq.status)));
  const quoteDone = Boolean(quote && ["sent"].includes(String(quote.status)));
  const poDone = Boolean(
    po &&
      (["approved", "ready_for_erp", "erp_created"].includes(String(po.status)) ||
        reconciliation?.status === "approved"),
  );
  const erpDone = Boolean(sales?.status === "erp_created");

  const stages = [
    {
      id: "rfq",
      label: fi ? "Tarjouspyyntö" : "RFQ",
      state: stageState(rfqDone, currentStage === "rfq"),
      value: rfq?.reference || "—",
    },
    {
      id: "quote",
      label: fi ? "Tarjous" : "Quote",
      state: stageState(quoteDone, currentStage === "quote"),
      value: quote?.quote_number || "—",
    },
    {
      id: "po",
      label: fi ? "Ostotilaus" : "Purchase order",
      state: stageState(poDone, currentStage === "po"),
      value: po?.po_number || "—",
    },
    {
      id: "erp",
      label: "ERP",
      state: stageState(erpDone, currentStage === "erp"),
      value: sales?.external_order_number || (sales ? (fi ? "Luonnos" : "Draft") : "—"),
    },
  ];

  let primary = {
    title: fi ? "Avaa tarjouspyyntö" : "Open RFQ",
    body: fi
      ? "Tarkista tarjouspyynnön rivit ja vahvista tuoteosumat."
      : "Review RFQ lines and confirm product matches.",
    action: fi ? "Avaa tarjouspyyntö" : "Open RFQ",
    href: rfqId ? `/app/rfq/${rfqId}` : "/app/orders",
  };

  if (rfq && rfq.status === "needs_review") {
    primary = {
      title: fi ? "Tarjouspyyntö tarvitsee päätöksesi" : "RFQ needs your decision",
      body: fi
        ? "Vahvista epävarmat tuoteosumat ennen tarjouksen luontia."
        : "Confirm uncertain product matches before creating the quote.",
      action: fi ? "Tarkista tarjouspyyntö" : "Review RFQ",
      href: `/app/rfq/${rfq.id}`,
    };
  } else if (quote && quote.status === "draft") {
    primary = {
      title: fi ? "Viimeistele tarjous" : "Finish the quote",
      body: fi
        ? "Tarkista hinnat ja kaupalliset tiedot ennen hyväksyntää."
        : "Review pricing and commercial details before approval.",
      action: fi ? "Viimeistele tarjous" : "Finish quote",
      href: `/app/quotes/${quote.id}`,
    };
  } else if (quote && quote.status === "ready") {
    primary = {
      title: fi ? "Tarjous odottaa hyväksyntää" : "Quote awaits approval",
      body: fi
        ? "Hyväksy kaupallinen tilannekuva ennen asiakkaalle lähettämistä."
        : "Approve the commercial snapshot before sending it to the customer.",
      action: fi ? "Hyväksy tarjous" : "Approve quote",
      href: `/app/quotes/${quote.id}`,
    };
  } else if (quote && quote.status === "approved") {
    primary = {
      title: fi ? "Tarjous on valmis lähetettäväksi" : "Quote is ready to send",
      body: fi
        ? "Lähetä hyväksytty tarjous asiakkaalle."
        : "Send the approved quote to the customer.",
      action: fi ? "Lähetä tarjous" : "Send quote",
      href: `/app/quotes/${quote.id}`,
    };
  } else if (quote && quote.status === "sent" && !po) {
    primary = {
      title: fi ? "Odotetaan asiakkaan tilausta" : "Waiting for the customer order",
      body: fi
        ? "Kun asiakkaan PO saapuu, lisää se tähän caseen. Tarjous valitaan automaattisesti."
        : "When the customer PO arrives, add it to this case. The quote is preselected.",
      action: fi ? "Lisää ostotilaus" : "Add purchase order",
      href: `/app/purchase-orders?quoteId=${quote.id}`,
    };
  } else if (po && ["extracted", "needs_review", "matched"].includes(String(po.status))) {
    primary = {
      title:
        po.status === "matched"
          ? fi
            ? "Tilaus vastaa tarjousta"
            : "Order matches the quote"
          : fi
            ? "Tilaus pitää tarkistaa"
            : "Order needs review",
      body:
        exceptionCount > 0
          ? fi
            ? `${exceptionCount} poikkeamaa odottaa tarkistusta. Näet vain kohdat, jotka tarvitsevat päätöksen.`
            : `${exceptionCount} exceptions need review. Only the items needing a decision are surfaced.`
          : fi
            ? "Quote ↔ PO -vertailu on valmis. Tarkista tulos ja hyväksy tilaus."
            : "Quote ↔ PO comparison is ready. Review the result and approve the order.",
      action: po.status === "matched"
        ? fi ? "Hyväksy tilaus" : "Approve order"
        : fi ? "Tarkista tilaus" : "Review order",
      href: `/app/purchase-orders/${po.id}`,
    };
  } else if (po && ["approved", "ready_for_erp"].includes(String(po.status)) && !sales) {
    primary = {
      title: fi ? "Tilaus on valmis myyntitilausluonnokseksi" : "Order is ready for a sales order draft",
      body: fi
        ? "Hyväksytty PO voidaan lukita ERP-vientiä varten."
        : "The approved PO can now be locked for ERP export.",
      action: fi ? "Luo myyntitilausluonnos" : "Create sales order draft",
      href: `/app/purchase-orders/${po.id}`,
    };
  } else if (sales && sales.status === "draft") {
    primary = bcExportReady
      ? {
          title: fi ? "Valmis Business Centraliin" : "Ready for Business Central",
          body: fi
            ? "Kaikki vientiehdot ja Business Central -vastineet ovat valmiit."
            : "All export requirements and Business Central mappings are ready.",
          action: fi ? "Jatka Business Centraliin" : "Continue to Business Central",
          href: `/app/sales-orders/${sales.id}`,
        }
      : {
          title: fi ? "Täydennä Business Central -vastineet" : "Complete Business Central mappings",
          body: fi
            ? `${bcMissingMappings}/${bcMappingTotal} vastinetta puuttuu tai vaatii tarkistuksen ennen vientiä.`
            : `${bcMissingMappings}/${bcMappingTotal} mappings are missing or require verification before export.`,
          action: fi ? "Tarkista vastineet" : "Review mappings",
          href: `/app/sales-orders/${sales.id}`,
        };
  } else if (sales && ["erp_failed", "erp_partial"].includes(String(sales.status))) {
    primary = {
      title: fi ? "ERP-vienti tarvitsee huomiota" : "ERP export needs attention",
      body:
        sales.erp_error ||
        (fi
          ? "Tarkista vientiyritys ennen kuin jatkat."
          : "Review the export attempt before continuing."),
      action: fi ? "Tarkista ERP-vienti" : "Review ERP export",
      href: `/app/sales-orders/${sales.id}`,
    };
  } else if (sales?.status === "erp_created") {
    primary = {
      title: fi ? "Tilaus on luotu Business Centraliin" : "Order created in Business Central",
      body: sales.external_order_number
        ? `${fi ? "Business Central -numero" : "Business Central number"}: ${sales.external_order_number}`
        : fi
          ? "ERP-vienti on valmis."
          : "ERP export is complete.",
      action: fi ? "Avaa myyntitilaus" : "Open sales order",
      href: `/app/sales-orders/${sales.id}`,
    };
  }

  const documents = [
    rfq && {
      label: fi ? "Tarjouspyyntö" : "RFQ",
      value: rfq.reference || "RFQ",
      href: `/app/rfq/${rfq.id}`,
      status: String(rfq.status),
    },
    quote && {
      label: fi ? "Tarjous" : "Quote",
      value: quote.quote_number || (fi ? "Tarjous" : "Quote"),
      href: `/app/quotes/${quote.id}`,
      status: String(quote.status),
    },
    po && {
      label: fi ? "Ostotilaus" : "Purchase order",
      value: po.po_number || "PO",
      href: `/app/purchase-orders/${po.id}`,
      status: String(po.status),
    },
    sales && {
      label: fi ? "Myyntitilausluonnos" : "Sales order draft",
      value: sales.external_order_number || sales.customer_po_number || "ERP",
      href: `/app/sales-orders/${sales.id}`,
      status: String(sales.status),
    },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string; status: string }>;

  return (
    <div className="app-page-v2 case-workspace-v1">
      <div className="mb-6">
        <Link href="/app/orders" className="text-sm font-semibold text-[var(--muted)] hover:text-[#171a18]">
          ← {fi ? "Tilaukset" : "Orders"}
        </Link>
      </div>

      <header className="case-workspace-v1-head">
        <div>
          <div className="app-kicker-v2">{fi ? "Tilauscase" : "Order case"}</div>
          <h1>{customer}</h1>
          <p>
            {[rfq?.reference, quote?.quote_number, po?.po_number]
              .filter(Boolean)
              .join(" · ") || (fi ? "Uusi case" : "New case")}
          </p>
        </div>
        {total > 0 ? (
          <div className="case-workspace-v1-value">
            <span>{fi ? "Arvo" : "Value"}</span>
            <strong>{money(displayLocale, currency, total)}</strong>
          </div>
        ) : null}
      </header>

      <section className="case-progress-v1" aria-label={fi ? "Tilauksen eteneminen" : "Order progress"}>
        {stages.map((stage, index) => (
          <div key={stage.id} className={`case-progress-v1-step is-${stage.state}`}>
            <div className="case-progress-v1-marker">
              {stage.state === "done" ? "✓" : index + 1}
            </div>
            <div>
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
            </div>
          </div>
        ))}
      </section>

      <div className="case-workspace-v1-grid">
        <main>
          <section className="case-primary-v1">
            <div className="upload-v2-section-label">{fi ? "Seuraava tehtävä" : "Next action"}</div>
            <h2>{primary.title}</h2>
            <p>{primary.body}</p>
            <Link href={primary.href} className="upload-v2-primary-btn">
              {primary.action} <span aria-hidden="true">→</span>
            </Link>
          </section>

          {po && reconciliation ? (
            <section className="case-reconciliation-v1">
              <div>
                <div className="upload-v2-section-label">{fi ? "Quote ↔ PO" : "Quote ↔ PO"}</div>
                <h2>
                  {reconciliation.status === "matched"
                    ? fi ? "Tilaus täsmää tarjoukseen" : "Order matches the quote"
                    : reconciliation.status === "approved"
                      ? fi ? "Vertailu hyväksytty" : "Comparison approved"
                      : fi ? "Poikkeamia pitää tarkistaa" : "Exceptions need review"}
                </h2>
                <p>
                  {exceptionCount > 0
                    ? fi
                      ? `${exceptionCount} avointa poikkeamaa.`
                      : `${exceptionCount} open exceptions.`
                    : fi
                      ? "Ei avoimia poikkeamia."
                      : "No open exceptions."}
                </p>
              </div>
              <Link href={`/app/purchase-orders/${po.id}`} className="btn-secondary">
                {fi ? "Avaa vertailu" : "Open comparison"} →
              </Link>
            </section>
          ) : null}

          <section className="case-documents-v1">
            <div className="case-documents-v1-head">
              <div>
                <div className="upload-v2-section-label">{fi ? "Case" : "Case"}</div>
                <h2>{fi ? "Dokumentit ja vaiheet" : "Documents and stages"}</h2>
              </div>
              <span>{documents.length} / 4</span>
            </div>
            <div className="case-documents-v1-list">
              {documents.map((document) => (
                <Link key={document.href} href={document.href} className="case-documents-v1-row">
                  <div>
                    <span>{document.label}</span>
                    <strong>{document.value}</strong>
                  </div>
                  <div>
                    <span>{fi ? "Tila" : "Status"}</span>
                    <strong>{caseStatusLabel(document.status, fi)}</strong>
                  </div>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </section>
        </main>

        <aside className="case-summary-v1">
          <div className="upload-v2-section-label">{fi ? "Yhteenveto" : "Summary"}</div>
          <h2>{fi ? "Tämä case" : "This case"}</h2>

          <dl>
            <div>
              <dt>{fi ? "Asiakas" : "Customer"}</dt>
              <dd>{customer}</dd>
            </div>
            <div>
              <dt>RFQ</dt>
              <dd>{rfq?.reference || "—"}</dd>
            </div>
            <div>
              <dt>{fi ? "Tarjous" : "Quote"}</dt>
              <dd>{quote?.quote_number || "—"}</dd>
            </div>
            <div>
              <dt>PO</dt>
              <dd>{po?.po_number || "—"}</dd>
            </div>
            <div>
              <dt>{fi ? "Päivitetty" : "Updated"}</dt>
              <dd>
                {new Date(
                  sales?.updated_at ||
                    po?.updated_at ||
                    quote?.updated_at ||
                    rfq?.received_at ||
                    Date.now(),
                ).toLocaleDateString(displayLocale)}
              </dd>
            </div>
          </dl>

          <div className="case-summary-v1-links">
            {rfq ? <Link href={`/app/rfq/${rfq.id}`}>RFQ →</Link> : null}
            {quote ? <Link href={`/app/quotes/${quote.id}`}>{fi ? "Tarjous" : "Quote"} →</Link> : null}
            {po ? <Link href={`/app/purchase-orders/${po.id}`}>PO →</Link> : null}
            {sales ? <Link href={`/app/sales-orders/${sales.id}`}>ERP →</Link> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
