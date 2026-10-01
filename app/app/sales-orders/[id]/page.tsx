import Link from "next/link";
import { notFound } from "next/navigation";
import { formatLocale, getLocale } from "@/lib/locale";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getBusinessCentralConfigurationStatus } from "@/lib/rivora/erp/business-central";
import {
  saveErpMappingAction,
  sendBusinessCentralSalesOrderAction,
} from "../actions";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function statusLabel(status: string, fi: boolean) {
  const labels: Record<string, string> = fi
    ? {
        draft: "Luonnos",
        erp_pending: "Viedään ERP:iin",
        erp_created: "Luotu ERP:iin",
        erp_partial: "ERP-tarkistus vaaditaan",
        erp_failed: "ERP-vienti epäonnistui",
      }
    : {
        draft: "Draft",
        erp_pending: "Sending to ERP",
        erp_created: "Created in ERP",
        erp_partial: "ERP review required",
        erp_failed: "ERP export failed",
      };
  return labels[status] ?? status;
}

export default async function SalesOrderDraftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; erpError?: string }>;
}) {
  const [{ id }, query, locale, context] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);

  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);
  const canAdmin = ["owner", "admin"].includes(workspace.role);

  const { data: draft, error: draftError } = await supabase
    .from("sales_order_drafts")
    .select(
      "id,purchase_order_id,reconciliation_id,quote_id,customer_id,status,customer_po_number,order_date,currency,source_policy,source_summary,erp_provider,external_order_id,external_order_number,erp_error,created_at,updated_at,customers(name),purchase_orders(po_number,status),quotes(quote_number)",
    )
    .eq("id", id)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (draftError) throw draftError;
  if (!draft) notFound();

  const [{ data: lines }, { data: attempts }] = await Promise.all([
    supabase
      .from("sales_order_draft_lines")
      .select(
        "id,line_number,product_id,sku,description,quantity,unit,unit_price,line_total,source_resolution,products(name,sku,manufacturer)",
      )
      .eq("sales_order_draft_id", id)
      .eq("organization_id", workspace.id)
      .order("line_number"),
    supabase
      .from("erp_delivery_attempts")
      .select(
        "id,provider,attempt_no,status,external_order_id,external_order_number,error_message,response_summary,created_at,completed_at",
      )
      .eq("sales_order_draft_id", id)
      .eq("organization_id", workspace.id)
      .order("attempt_no", { ascending: false }),
  ]);

  const localIds = [
    String(draft.customer_id),
    ...(lines ?? []).map((line: any) => String(line.product_id)),
  ];

  const { data: mappings } = localIds.length
    ? await supabase
        .from("erp_entity_mappings")
        .select("entity_type,local_entity_id,external_number,external_id,metadata")
        .eq("organization_id", workspace.id)
        .eq("provider", "business_central")
        .in("local_entity_id", localIds)
    : { data: [] as any[] };

  const customerMapping = (mappings ?? []).find(
    (mapping: any) =>
      mapping.entity_type === "customer" &&
      String(mapping.local_entity_id) === String(draft.customer_id),
  );

  const productMappings = new Map<string, any>();
  for (const mapping of mappings ?? []) {
    if (mapping.entity_type === "product") {
      productMappings.set(String(mapping.local_entity_id), mapping);
    }
  }

  const missingProductMappings = (lines ?? []).filter(
    (line: any) => !productMappings.get(String(line.product_id))?.external_number,
  );

  const config = getBusinessCentralConfigurationStatus(workspace.id);
  const adapterReady =
    config.configured &&
    Boolean(customerMapping?.external_number) &&
    missingProductMappings.length === 0;

  const customer = relationOne<any>((draft as any).customers);
  const purchaseOrder = relationOne<any>((draft as any).purchase_orders);
  const quote = relationOne<any>((draft as any).quotes);
  const money = new Intl.NumberFormat(displayLocale, {
    style: "currency",
    currency: draft.currency || "EUR",
  });
  const subtotal = (lines ?? []).reduce(
    (sum: number, line: any) => sum + Number(line.line_total ?? 0),
    0,
  );

  return (
    <div className="app-page-v2">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/sales-orders" className="text-sm font-semibold">
          ← {fi ? "Myyntitilaukset" : "Sales orders"}
        </Link>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={"/app/purchase-orders/" + draft.purchase_order_id}>
            {fi ? "Avaa PO" : "Open PO"} →
          </Link>
          <Link href={"/app/quotes/" + draft.quote_id}>
            {fi ? "Avaa tarjous" : "Open quote"} →
          </Link>
        </div>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="app-kicker-v2">Sales Order Draft</div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            {draft.customer_po_number}
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            {(customer?.name || "—") +
              " · PO " +
              (purchaseOrder?.po_number || draft.customer_po_number) +
              " · " +
              (quote?.quote_number || "—")}
          </p>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold">
          {statusLabel(String(draft.status), fi)}
        </span>
      </header>

      {query.erpError || draft.erp_error ? (
        <section className="upload-v2-alert error mt-6">
          {query.erpError || draft.erp_error}
        </section>
      ) : null}

      {query.saved ? (
        <section className="upload-v2-alert success mt-6">{query.saved}</section>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Asiakas" : "Customer"}
          </span>
          <strong className="mt-2 block text-lg">{customer?.name || "—"}</strong>
        </div>
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Tilauspäivä" : "Order date"}
          </span>
          <strong className="mt-2 block text-lg">
            {new Date(String(draft.order_date) + "T12:00:00Z").toLocaleDateString(displayLocale)}
          </strong>
        </div>
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Rivejä" : "Lines"}
          </span>
          <strong className="mt-2 block text-lg">{lines?.length ?? 0}</strong>
        </div>
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Arvo" : "Value"}
          </span>
          <strong className="mt-2 block text-lg">{money.format(subtotal)}</strong>
        </div>
      </section>

      <section className="surface mt-6 overflow-hidden">
        <div className="border-b border-[var(--line)] p-6">
          <div className="upload-v2-section-label">
            {fi ? "Lukittu tilausluonnos" : "Locked order draft"}
          </div>
          <h2 className="mt-2 text-2xl font-bold">
            {fi ? "PO-arvot + hyväksytty tuoteidentiteetti" : "PO values + approved product identity"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            {fi
              ? "Määrä, yksikkö ja hinta tulevat hyväksytystä PO:sta, kun ne ovat dokumentissa. Tuote tulee hyväksytystä tarjousrivistä. Luonnoksen kaupallisia arvoja ei muokata ERP-viennin aikana."
              : "Quantity, unit and price come from the approved PO when present. Product identity comes from the approved quote line. Commercial values are not edited during ERP export."}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[#fafbfa] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">{fi ? "Kuvaus" : "Description"}</th>
                <th className="px-5 py-3">{fi ? "Määrä" : "Quantity"}</th>
                <th className="px-5 py-3">{fi ? "Yksikköhinta" : "Unit price"}</th>
                <th className="px-5 py-3">{fi ? "Rivisumma" : "Line total"}</th>
                <th className="px-5 py-3">Business Central</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {(lines ?? []).map((line: any) => {
                const mapping = productMappings.get(String(line.product_id));
                return (
                  <tr key={line.id} className="align-top">
                    <td className="px-5 py-4 font-semibold">{line.line_number}</td>
                    <td className="px-5 py-4 font-semibold">{line.sku}</td>
                    <td className="max-w-md px-5 py-4">{line.description}</td>
                    <td className="px-5 py-4">
                      {Number(line.quantity).toLocaleString(displayLocale)} {line.unit}
                    </td>
                    <td className="px-5 py-4">{money.format(Number(line.unit_price))}</td>
                    <td className="px-5 py-4 font-semibold">
                      {money.format(Number(line.line_total))}
                    </td>
                    <td className="px-5 py-4">
                      {canAdmin && ["draft", "erp_failed"].includes(String(draft.status)) ? (
                        <form action={saveErpMappingAction} className="flex min-w-[220px] gap-2">
                          <input type="hidden" name="salesOrderDraftId" value={draft.id} />
                          <input type="hidden" name="entityType" value="product" />
                          <input type="hidden" name="localEntityId" value={line.product_id} />
                          <input
                            name="externalNumber"
                            required
                            maxLength={120}
                            defaultValue={mapping?.external_number || ""}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                            placeholder={fi ? "BC item no." : "BC item no."}
                          />
                          <button className="rounded-lg border border-[var(--line)] px-3 py-2 font-semibold">
                            {fi ? "Tallenna" : "Save"}
                          </button>
                        </form>
                      ) : (
                        <strong>{mapping?.external_number || "—"}</strong>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface mt-6 p-6">
        <div className="upload-v2-section-label">Microsoft Dynamics 365 Business Central</div>
        <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold">
              {fi ? "ERP-mäppäys" : "ERP mapping"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {fi
                ? "Averomira ei oleta, että oma SKU tai asiakas-ID on sama kuin Business Centralissa. Tunnisteet pitää vahvistaa ennen ensimmäistä vientiä."
                : "Averomira does not assume local SKUs or customer IDs equal Business Central identifiers. Confirm them before the first export."}
            </p>

            <div className="mt-4 rounded-xl border border-[var(--line)] p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                {fi ? "Asiakasnumero Business Centralissa" : "Business Central customer number"}
              </span>
              {canAdmin && ["draft", "erp_failed"].includes(String(draft.status)) ? (
                <form action={saveErpMappingAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="salesOrderDraftId" value={draft.id} />
                  <input type="hidden" name="entityType" value="customer" />
                  <input type="hidden" name="localEntityId" value={draft.customer_id} />
                  <input
                    name="externalNumber"
                    required
                    maxLength={120}
                    defaultValue={customerMapping?.external_number || ""}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    placeholder="10000"
                  />
                  <button className="rounded-lg border border-[var(--line)] px-3 py-2 font-semibold">
                    {fi ? "Tallenna" : "Save"}
                  </button>
                </form>
              ) : (
                <strong className="mt-2 block">{customerMapping?.external_number || "—"}</strong>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[#fafbfa] p-5">
            <div className="flex items-center justify-between gap-3">
              <strong>{fi ? "Adapterin tila" : "Adapter status"}</strong>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs font-bold " +
                  (config.configured
                    ? "bg-[var(--green-soft)] text-[var(--green-dark)]"
                    : "bg-[#fff0f0] text-[#9a2d2d]")
                }
              >
                {config.configured ? (fi ? "Konfiguroitu" : "Configured") : (fi ? "Ei valmis" : "Not ready")}
              </span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">{fi ? "Ympäristö" : "Environment"}</dt>
                <dd className="font-semibold">{config.environment || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">{fi ? "Company ID" : "Company ID"}</dt>
                <dd className="font-mono text-xs">{config.companyId || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">{fi ? "Puuttuvat item-mäppäykset" : "Missing item mappings"}</dt>
                <dd className="font-semibold">{missingProductMappings.length}</dd>
              </div>
            </dl>

            {!config.configured ? (
              <div className="mt-4 rounded-xl bg-white p-4 text-xs leading-5 text-[var(--muted)]">
                {fi
                  ? "Palvelinpuolen Business Central OAuth -asetukset pitää lisätä Vercelin ympäristömuuttujiin ennen ensimmäistä vientiä."
                  : "Server-side Business Central OAuth settings must be added to Vercel environment variables before the first export."}
              </div>
            ) : null}

            {draft.status === "erp_created" ? (
              <div className="mt-4 rounded-xl bg-[var(--green-soft)] p-4 text-sm text-[var(--green-dark)]">
                <strong className="block">{fi ? "Luotu Business Centraliin" : "Created in Business Central"}</strong>
                <span className="mt-1 block">
                  {draft.external_order_number || draft.external_order_id || "—"}
                </span>
              </div>
            ) : draft.status === "erp_partial" ? (
              <div className="mt-4 rounded-xl bg-[#fff8ed] p-4 text-sm text-[#7f5719]">
                <strong className="block">{fi ? "Automaattinen retry lukittu" : "Automatic retry locked"}</strong>
                <span className="mt-1 block">
                  {fi
                    ? "Business Centralissa voi jo olla order. Tarkista ERP ennen jatkoa."
                    : "An order may already exist in Business Central. Review ERP before continuing."}
                </span>
              </div>
            ) : null}

            {canAdmin &&
            adapterReady &&
            ["draft", "erp_failed"].includes(String(draft.status)) ? (
              <form action={sendBusinessCentralSalesOrderAction} className="mt-5">
                <input type="hidden" name="salesOrderDraftId" value={draft.id} />
                <button className="upload-v2-primary-btn">
                  {fi ? "Luo Draft-order Business Centraliin" : "Create Draft order in Business Central"} →
                </button>
              </form>
            ) : null}

            {["draft", "erp_failed"].includes(String(draft.status)) && !adapterReady ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                {fi
                  ? "Vienti aktivoituu, kun adapteri, asiakasmäppäys ja kaikki item-mäppäykset ovat valmiit."
                  : "Export becomes available when the adapter, customer mapping and every item mapping are ready."}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="surface mt-6 overflow-hidden">
        <div className="border-b border-[var(--line)] p-6">
          <div className="upload-v2-section-label">{fi ? "ERP audit trail" : "ERP audit trail"}</div>
          <h2 className="mt-2 text-2xl font-bold">{fi ? "Vientiyritykset" : "Export attempts"}</h2>
        </div>
        {(attempts ?? []).length ? (
          <div className="divide-y divide-[var(--line)]">
            {(attempts ?? []).map((attempt: any) => (
              <div key={attempt.id} className="grid gap-3 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
                <span className="text-sm font-bold">#{attempt.attempt_no}</span>
                <div>
                  <strong className="block">{attempt.status}</strong>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {new Date(attempt.created_at).toLocaleString(displayLocale)}
                    {attempt.external_order_number ? " · " + attempt.external_order_number : ""}
                  </span>
                  {attempt.error_message ? (
                    <span className="mt-2 block text-sm text-[#9a2d2d]">{attempt.error_message}</span>
                  ) : null}
                </div>
                <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {attempt.provider}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-[var(--muted)]">
            {fi ? "ERP-vientiä ei ole vielä yritetty." : "No ERP export has been attempted yet."}
          </div>
        )}
      </section>
    </div>
  );
}
