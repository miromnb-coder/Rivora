import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocale } from "@/lib/locale";
import {
  PURCHASE_ORDER_FIELD_MEMORY_TARGETS,
  type PurchaseOrderFieldMemoryTarget,
} from "@/lib/rivora/imports";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  createCustomerPoFieldMemory,
  deleteCustomerMemoryMapping,
  deleteCustomerScalarMemory,
  updateCustomerMemoryMapping,
  updateCustomerPoFieldMemory,
} from "./actions";

function memoryStateLabel(state: string, fi: boolean) {
  const labels: Record<string, [string, string]> = {
    verified: ["Vahvistettu", "Verified"],
    proposed: ["Odottaa vahvistusta", "Needs verification"],
    conflict: ["Ristiriita", "Conflict"],
    disabled: ["Poistettu käytöstä", "Disabled"],
  };
  return labels[state]?.[fi ? 0 : 1] ?? state.replaceAll("_", " ");
}

function memorySourceLabel(
  source: string,
  metadata: Record<string, unknown> | null,
  fi: boolean,
) {
  if (metadata?.migrated_from_legacy_memory === true) {
    return fi ? "Migroitu aiemmasta muistista" : "Migrated from earlier memory";
  }

  const labels: Record<string, [string, string]> = {
    manual_confirmation: ["Ihmisen vahvistama", "Human confirmed"],
    approved_quote: ["Hyväksytystä tarjouksesta", "From approved quote"],
    approved_po_reconciliation: [
      "Hyväksytystä PO-tarkistuksesta",
      "From approved PO review",
    ],
    verified_erp_mapping: [
      "Vahvistetusta ERP-vastineesta",
      "From verified ERP mapping",
    ],
    system_import: ["Järjestelmätuonti", "System import"],
  };
  return labels[source]?.[fi ? 0 : 1] ?? source.replaceAll("_", " ");
}

function poFieldLabel(field: string, fi: boolean) {
  const labels: Record<string, [string, string]> = {
    customer_sku: ["Asiakkaan SKU", "Customer SKU"],
    description: ["Kuvaus", "Description"],
    manufacturer: ["Valmistaja", "Manufacturer"],
    manufacturer_part_number: [
      "Valmistajan tuotenumero",
      "Manufacturer part number",
    ],
    quantity: ["Määrä", "Quantity"],
    unit: ["Yksikkö", "Unit"],
    unit_price: ["Bruttoyksikköhinta", "Gross unit price"],
    net_unit_price: ["Nettoyksikköhinta", "Net unit price"],
    discount_percent: ["Alennus %", "Discount %"],
    line_total: ["Rivisumma", "Line total"],
  };
  return labels[field]?.[fi ? 0 : 1] ?? field.replaceAll("_", " ");
}

function scalarTypeLabel(type: string, fi: boolean) {
  if (type === "customer_unit_alias") {
    return fi ? "Yksikköalias" : "Unit alias";
  }
  if (type === "customer_po_field_alias") {
    return fi ? "PO-saraketulkinta" : "PO column interpretation";
  }
  return type.replaceAll("_", " ");
}

async function loadWorkspaceCustomers(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const pageSize = 500;
  const customers: any[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name")
      .eq("organization_id", organizationId)
      .order("name")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    customers.push(...(data ?? []));

    if (!data || data.length < pageSize) break;
  }

  return customers;
}

export default async function MemoryPage() {
  const [{ supabase, workspace }, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);
  const fi = locale === "fi";
  const canEditProduct = ["owner", "admin", "member"].includes(workspace.role);
  const canManageControlled = ["owner", "admin"].includes(workspace.role);
  const dateFormatter = new Intl.DateTimeFormat(fi ? "fi-FI" : "en-US", {
    dateStyle: "medium",
  });

  const [{ data: memories }, allCustomers] = await Promise.all([
    supabase
      .from("workspace_memory_entries")
      .select(
        "id,customer_id,memory_type,source_value,target_entity_id,target_value,confidence,verification_state,source,source_entity_type,source_entity_id,metadata,verified_at,last_used_at,use_count,created_at,updated_at",
      )
      .eq("organization_id", workspace.id)
      .eq("scope", "customer")
      .in("memory_type", [
        "customer_sku_product",
        "customer_unit_alias",
        "customer_po_field_alias",
      ])
      .order("updated_at", { ascending: false })
      .limit(750),
    loadWorkspaceCustomers(supabase, workspace.id),
  ]);

  const rows = memories ?? [];
  const productRows = rows.filter(
    (row: any) => String(row.memory_type) === "customer_sku_product",
  );
  const controlledRows = rows.filter((row: any) =>
    ["customer_unit_alias", "customer_po_field_alias"].includes(
      String(row.memory_type),
    ),
  );

  const productIds = Array.from(
    new Set(
      productRows
        .map((row: any) => String(row.target_entity_id || ""))
        .filter(Boolean),
    ),
  );

  const { data: products } = productIds.length
    ? await supabase
        .from("products")
        .select("id,sku,name,manufacturer,active")
        .in("id", productIds)
    : { data: [] as any[] };

  const customerById = new Map(
    (allCustomers ?? []).map((customer: any) => [
      String(customer.id),
      customer,
    ]),
  );
  const productById = new Map(
    (products ?? []).map((product: any) => [String(product.id), product]),
  );

  const activeRows = rows.filter(
    (row: any) => String(row.verification_state) !== "disabled",
  );
  const verifiedRows = activeRows.filter(
    (row: any) => String(row.verification_state) === "verified",
  );
  const reviewRows = activeRows.filter(
    (row: any) => String(row.verification_state) !== "verified",
  );
  const totalUses = rows.reduce(
    (sum: number, row: any) => sum + Number(row.use_count ?? 0),
    0,
  );

  const text = {
    settings: fi ? "Asetukset" : "Settings",
    kicker: fi ? "Asetukset · Älykäs muisti" : "Settings · Smart memory",
    title: fi
      ? "Näe, mitä Averomira muistaa — ja hallitse sitä."
      : "See what Averomira remembers — and control it.",
    description: fi
      ? "Vain vahvistettua muistia käytetään uudelleen. Tuotevastineiden lisäksi hallittu laajennus voi muistaa asiakaskohtaisia yksikköaliasia ja rakenteisten PO-tiedostojen sarakeotsikoita."
      : "Only verified memory is reused. Alongside product mappings, controlled expansion can remember customer-specific unit aliases and structured PO column headers.",
    active: fi ? "Aktiiviset muistot" : "Active memories",
    verified: fi ? "Vahvistetut" : "Verified",
    review: fi ? "Vaatii tarkistuksen" : "Needs review",
    uses: fi ? "Käyttökerrat" : "Uses",
    entries: fi ? "Tuotemuisti" : "Product memory",
    listTitle: fi
      ? "Asiakkaan tunniste → katalogituote"
      : "Customer identifier → catalogue product",
    newest: fi ? "Uusimmat muutokset ensin" : "Newest changes first",
    customer: fi ? "Asiakas" : "Customer",
    input: fi ? "Muistettu tunniste" : "Remembered identifier",
    product: fi ? "Katalogituote" : "Catalogue product",
    state: fi ? "Tila" : "State",
    confidence: fi ? "Varmuus" : "Confidence",
    verifiedAt: fi ? "Vahvistettu" : "Verified",
    lastUsed: fi ? "Viimeksi käytetty" : "Last used",
    never: fi ? "Ei vielä käytetty" : "Not used yet",
    unavailable: fi
      ? "Tuote ei ole enää saatavilla"
      : "Product is no longer available",
    inactive: fi ? "Tuote ei ole aktiivinen" : "Product is inactive",
    productSku: fi ? "Katalogin SKU" : "Catalogue SKU",
    save: fi ? "Tallenna / vahvista" : "Save / verify",
    deleteConfirm: fi
      ? "Vahvistan, että tämä vastine poistetaan aktiivisesta muistista."
      : "I confirm this mapping should be removed from active memory.",
    delete: fi ? "Poista muistista" : "Remove from memory",
    disabledNote: fi
      ? "Tämä muisti säilyy audit trailissa, mutta sitä ei enää käytetä."
      : "This memory remains in the audit trail but is no longer reused.",
    empty: fi ? "Muisti on vielä tyhjä" : "No memory yet",
    emptyTitle: fi
      ? "Älykäs muisti kasvaa ihmisen vahvistamista päätöksistä."
      : "Smart Memory grows from human-confirmed decisions.",
    emptyBody: fi
      ? "Vahvista tuote RFQ Review -näkymässä ja valitse “Muista tämä vastine tälle asiakkaalle”."
      : "Confirm a product in RFQ Review and choose “Remember this mapping for this customer”.",
  };

  return (
    <div className="app-page-v2 memory-app-v2">
      <Link href="/app/settings" className="rfq-review-v2-back">
        ← {text.settings}
      </Link>

      <header className="memory-app-v2-head">
        <div>
          <div className="app-kicker-v2">{text.kicker}</div>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>
      </header>

      <section
        className="memory-app-v2-summary"
        aria-label="Smart Memory summary"
      >
        <div>
          <span>{text.active}</span>
          <strong>{activeRows.length}</strong>
          <small>
            {fi ? "käytettävissä olevaa muistia" : "available memories"}
          </small>
        </div>
        <div>
          <span>{text.verified}</span>
          <strong>{verifiedRows.length}</strong>
          <small>{fi ? "saa käyttää uudelleen" : "eligible for reuse"}</small>
        </div>
        <div>
          <span>{text.review}</span>
          <strong>{reviewRows.length}</strong>
          <small>
            {fi ? "ei käytetä uudelleen" : "never reused automatically"}
          </small>
        </div>
        <div>
          <span>{text.uses}</span>
          <strong>{totalUses}</strong>
          <small>
            {fi ? "idempotenttia muistiosumaa" : "idempotent memory uses"}
          </small>
        </div>
      </section>

      <section className="memory-app-v2-list">
        <div className="memory-app-v2-list-head">
          <div>
            <div className="upload-v2-section-label">{text.entries}</div>
            <h2>{text.listTitle}</h2>
          </div>
          <span>{text.newest}</span>
        </div>

        {productRows.length ? (
          <div className="memory-app-v2-rows">
            {productRows.map((memory: any) => {
              const customer = customerById.get(String(memory.customer_id));
              const product = productById.get(String(memory.target_entity_id));
              const state = String(memory.verification_state || "proposed");
              const disabled = state === "disabled";
              const metadata =
                memory.metadata && typeof memory.metadata === "object"
                  ? (memory.metadata as Record<string, unknown>)
                  : null;
              const uses = Number(memory.use_count ?? 0);

              return (
                <article
                  key={memory.id}
                  className={
                    "memory-app-v2-row memory-m3-row" +
                    (disabled ? " is-disabled" : "")
                  }
                >
                  <div className="memory-app-v2-customer">
                    <span>{text.customer}</span>
                    <strong>
                      {customer?.name ??
                        (fi ? "Tuntematon asiakas" : "Unknown customer")}
                    </strong>
                    <small>
                      {memorySourceLabel(
                        String(memory.source || ""),
                        metadata,
                        fi,
                      )}
                    </small>
                  </div>

                  <div className="memory-app-v2-input">
                    <span>{text.input}</span>
                    <h3>{memory.source_value || "—"}</h3>
                    <p>
                      {text.state}: {memoryStateLabel(state, fi)}
                    </p>
                  </div>

                  <div
                    className="memory-app-v2-arrow"
                    aria-hidden="true"
                  >
                    →
                  </div>

                  <div className="memory-app-v2-product">
                    <span>{text.product}</span>
                    <h3>{product?.sku ?? "—"}</h3>
                    <p>{product?.name ?? text.unavailable}</p>
                    {product?.manufacturer ? (
                      <small>{product.manufacturer}</small>
                    ) : null}
                    {product && product.active === false ? (
                      <small className="memory-m3-warning">
                        {text.inactive}
                      </small>
                    ) : null}

                    {canEditProduct && !disabled ? (
                      <form
                        action={updateCustomerMemoryMapping}
                        className="memory-m3-edit"
                      >
                        <input
                          type="hidden"
                          name="memoryId"
                          value={memory.id}
                        />
                        <label>
                          <span>{text.productSku}</span>
                          <input
                            name="productSku"
                            required
                            defaultValue={product?.sku ?? ""}
                            aria-label={text.productSku}
                          />
                        </label>
                        <button className="btn-secondary">
                          {text.save}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  <div className="memory-app-v2-uses memory-m3-meta">
                    <span>{text.uses}</span>
                    <strong>{uses}</strong>
                    <small>
                      {text.confidence}:{" "}
                      {Math.round(Number(memory.confidence ?? 0))}%
                    </small>
                    <small>
                      {text.verifiedAt}:{" "}
                      {memory.verified_at
                        ? dateFormatter.format(new Date(memory.verified_at))
                        : "—"}
                    </small>
                    <small>
                      {text.lastUsed}:{" "}
                      {memory.last_used_at
                        ? dateFormatter.format(new Date(memory.last_used_at))
                        : text.never}
                    </small>

                    {disabled ? (
                      <p className="memory-m3-disabled-note">
                        {text.disabledNote}
                      </p>
                    ) : canManageControlled ? (
                      <form
                        action={deleteCustomerMemoryMapping}
                        className="memory-m3-delete"
                      >
                        <input
                          type="hidden"
                          name="memoryId"
                          value={memory.id}
                        />
                        <label>
                          <input
                            name="confirmDelete"
                            type="checkbox"
                            required
                          />
                          <span>{text.deleteConfirm}</span>
                        </label>
                        <button className="btn-secondary">
                          {text.delete}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="memory-app-v2-empty">
            <div className="upload-v2-section-label">{text.empty}</div>
            <h3>{text.emptyTitle}</h3>
            <p>{text.emptyBody}</p>
          </div>
        )}
      </section>

      <section className="surface mt-14 overflow-hidden">
        <div className="border-b border-[var(--line)] p-6">
          <div className="upload-v2-section-label">
            {fi ? "M4 · Hallittu laajennus" : "M4 · Controlled expansion"}
          </div>
          <h2 className="mt-2 text-2xl font-bold">
            {fi
              ? "Muista turvallisia asiakaskohtaisia tulkintoja."
              : "Remember safe customer-specific interpretations."}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Yksikkömuisti syntyy vain hyväksytyn PO-poikkeaman yhteydessä ja käsittelee pelkän aliasnimen — ei määrämuunnosta. PO-sarakemuisti koskee vain CSV/XLSX-tuonteja ja vain alla sallittuja kenttiä."
              : "Unit memory is learned only while a PO exception is accepted and treats unit names as aliases only — never as a quantity conversion. PO column memory applies only to CSV/XLSX imports and the allow-listed fields below."}
          </p>
        </div>

        <div className="grid gap-px bg-[var(--line)] md:grid-cols-2">
          <div className="bg-white p-5">
            <strong className="block text-sm">
              {fi ? "Yksikköaliasit" : "Unit aliases"}
            </strong>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {fi
                ? "Esim. asiakkaan “ST” voidaan muistaa vastaamaan “pcs”, mutta vain kun ihminen hyväksyy yhtä suurten määrien unit mismatch -poikkeaman."
                : "For example, a customer's “ST” may be remembered as “pcs”, but only when a person accepts an equal-quantity unit mismatch."}
            </p>
          </div>
          <div className="bg-white p-5">
            <strong className="block text-sm">
              {fi ? "PO-saraketulkinnat" : "PO column interpretations"}
            </strong>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {fi
                ? "Esim. “Bestellmenge” → määrä. Muisti tulkitsee vain otsikon; se ei muuta tiedoston arvoja."
                : "For example, “Bestellmenge” → quantity. Memory interprets the header only; it does not change file values."}
            </p>
          </div>
        </div>

        {canManageControlled ? (
          <div className="border-t border-[var(--line)] bg-[#fafbfa] p-6">
            <div className="upload-v2-section-label">
              {fi
                ? "Lisää PO-saraketulkinta"
                : "Add PO column interpretation"}
            </div>
            <form
              action={createCustomerPoFieldMemory}
              className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
            >
              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {text.customer}
                </span>
                <select
                  name="customerId"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                >
                  <option value="">
                    {fi ? "Valitse asiakas" : "Choose customer"}
                  </option>
                  {(allCustomers ?? []).map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {fi ? "Asiakkaan sarakeotsikko" : "Customer column header"}
                </span>
                <input
                  name="sourceHeader"
                  required
                  maxLength={120}
                  placeholder="Bestellmenge"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {fi ? "Tulkitaan kentäksi" : "Interpret as"}
                </span>
                <select
                  name="targetField"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                >
                  {PURCHASE_ORDER_FIELD_MEMORY_TARGETS.map(
                    (field: PurchaseOrderFieldMemoryTarget) => (
                      <option key={field} value={field}>
                        {poFieldLabel(field, fi)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <button className="upload-v2-secondary-btn">
                {fi ? "Tallenna vahvistettu tulkinta" : "Save verified interpretation"}
              </button>
            </form>
          </div>
        ) : null}

        <div className="divide-y divide-[var(--line)]">
          {controlledRows.length ? (
            controlledRows.map((memory: any) => {
              const customer = customerById.get(String(memory.customer_id));
              const state = String(memory.verification_state || "proposed");
              const disabled = state === "disabled";
              const isField =
                String(memory.memory_type) === "customer_po_field_alias";

              return (
                <article
                  key={memory.id}
                  className={
                    "grid gap-5 p-6 lg:grid-cols-[1fr_1.15fr_1.15fr_180px]" +
                    (disabled ? " opacity-60" : "")
                  }
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {text.customer}
                    </span>
                    <strong className="mt-2 block text-sm">
                      {customer?.name ??
                        (fi ? "Tuntematon asiakas" : "Unknown customer")}
                    </strong>
                    <small className="mt-1 block text-[var(--muted)]">
                      {scalarTypeLabel(String(memory.memory_type), fi)}
                    </small>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {fi ? "Asiakkaan arvo" : "Customer value"}
                    </span>
                    <strong className="mt-2 block">
                      {memory.source_value || "—"}
                    </strong>
                    <small className="mt-1 block text-[var(--muted)]">
                      {memorySourceLabel(
                        String(memory.source || ""),
                        memory.metadata &&
                          typeof memory.metadata === "object"
                          ? (memory.metadata as Record<string, unknown>)
                          : null,
                        fi,
                      )}
                    </small>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {fi ? "Vahvistettu tulkinta" : "Verified interpretation"}
                    </span>
                    <strong className="mt-2 block">
                      {isField
                        ? poFieldLabel(String(memory.target_value || ""), fi)
                        : String(memory.target_value || "—")}
                    </strong>

                    {isField && canManageControlled && !disabled ? (
                      <form
                        action={updateCustomerPoFieldMemory}
                        className="mt-3 flex flex-wrap gap-2"
                      >
                        <input
                          type="hidden"
                          name="memoryId"
                          value={memory.id}
                        />
                        <select
                          name="targetField"
                          defaultValue={String(memory.target_value || "")}
                          className="min-w-[200px] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        >
                          {PURCHASE_ORDER_FIELD_MEMORY_TARGETS.map(
                            (field: PurchaseOrderFieldMemoryTarget) => (
                              <option key={field} value={field}>
                                {poFieldLabel(field, fi)}
                              </option>
                            ),
                          )}
                        </select>
                        <button className="btn-secondary">
                          {fi ? "Vaihda" : "Change"}
                        </button>
                      </form>
                    ) : !isField ? (
                      <small className="mt-2 block text-[var(--muted)]">
                        {fi
                          ? "Yksikköalias voidaan oppia vain PO-poikkeaman ihmishyväksynnästä."
                          : "Unit aliases can only be learned from a human-approved PO exception."}
                      </small>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {text.state}
                    </span>
                    <strong className="mt-2 block text-sm">
                      {memoryStateLabel(state, fi)}
                    </strong>
                    <small className="mt-1 block text-[var(--muted)]">
                      {Number(memory.use_count ?? 0)} {text.uses.toLowerCase()}
                    </small>
                    <small className="mt-1 block text-[var(--muted)]">
                      {memory.last_used_at
                        ? dateFormatter.format(new Date(memory.last_used_at))
                        : text.never}
                    </small>

                    {disabled ? (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        {text.disabledNote}
                      </p>
                    ) : canManageControlled ? (
                      <form
                        action={deleteCustomerScalarMemory}
                        className="mt-3 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="memoryId"
                          value={memory.id}
                        />
                        <label className="flex items-start gap-2 text-xs text-[var(--muted)]">
                          <input
                            name="confirmDelete"
                            type="checkbox"
                            required
                            className="mt-0.5"
                          />
                          <span>
                            {fi
                              ? "Poista aktiivisesta muistista"
                              : "Remove from active memory"}
                          </span>
                        </label>
                        <button className="btn-secondary">
                          {text.delete}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="p-6 text-sm text-[var(--muted)]">
              {fi
                ? "Hallittuja M4-muistoja ei ole vielä. Yksikköaliasit syntyvät PO Review:ssa; PO-saraketulkintoja owner/admin voi lisätä yllä."
                : "No controlled M4 memories yet. Unit aliases are learned in PO Review; owners/admins can add PO column interpretations above."}
            </div>
          )}
        </div>
      </section>

      <section className="memory-app-v2-explainer">
        <div>
          <span>1</span>
          <b>{fi ? "Ihminen vahvistaa" : "Human confirms"}</b>
          <small>
            {fi
              ? "Tuotevastine, PO-poikkeama tai sallittu saraketulkinta vahvistetaan eksplisiittisesti."
              : "A product mapping, PO exception or allow-listed column interpretation is explicitly confirmed."}
          </small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>2</span>
          <b>{fi ? "Muisti säilyttää provenance-tiedon" : "Memory keeps provenance"}</b>
          <small>
            {fi
              ? "Lähde, vahvistaja, käyttö ja alkuperäinen tulkinta säilyvät audit trailissa."
              : "Source, reviewer, usage and original interpretation remain auditable."}
          </small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>3</span>
          <b>{fi ? "Vain verified-muisti auttaa" : "Only verified memory assists"}</b>
          <small>
            {fi
              ? "Muisti voi priorisoida tai tulkita ennalta rajatun asian, mutta se ei tee kaupallista päätöstä."
              : "Memory may prioritize or interpret a narrowly defined fact, but it does not make a commercial decision."}
          </small>
        </div>
      </section>
    </div>
  );
}
