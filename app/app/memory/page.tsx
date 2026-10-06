import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import {
  deleteCustomerMemoryMapping,
  updateCustomerMemoryMapping,
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
    approved_po_reconciliation: ["Hyväksytystä PO-tarkistuksesta", "From approved PO review"],
    verified_erp_mapping: ["Vahvistetusta ERP-vastineesta", "From verified ERP mapping"],
    system_import: ["Järjestelmätuonti", "System import"],
  };
  return labels[source]?.[fi ? 0 : 1] ?? source.replaceAll("_", " ");
}

export default async function MemoryPage() {
  const [{ supabase, workspace }, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);
  const fi = locale === "fi";
  const canEdit = ["owner", "admin", "member"].includes(workspace.role);
  const canDelete = ["owner", "admin"].includes(workspace.role);
  const dateFormatter = new Intl.DateTimeFormat(fi ? "fi-FI" : "en-US", {
    dateStyle: "medium",
  });

  const { data: memories } = await supabase
    .from("workspace_memory_entries")
    .select(
      "id,customer_id,source_value,target_entity_id,confidence,verification_state,source,source_entity_type,source_entity_id,metadata,verified_at,last_used_at,use_count,created_at,updated_at",
    )
    .eq("organization_id", workspace.id)
    .eq("scope", "customer")
    .eq("memory_type", "customer_sku_product")
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = memories ?? [];
  const customerIds = Array.from(
    new Set(rows.map((row: any) => String(row.customer_id || "")).filter(Boolean)),
  );
  const productIds = Array.from(
    new Set(rows.map((row: any) => String(row.target_entity_id || "")).filter(Boolean)),
  );

  const [{ data: customers }, { data: products }] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id,name").in("id", customerIds)
      : Promise.resolve({ data: [] as any[] }),
    productIds.length
      ? supabase
          .from("products")
          .select("id,sku,name,manufacturer,active")
          .in("id", productIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const customerById = new Map(
    (customers ?? []).map((customer: any) => [String(customer.id), customer]),
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
      ? "Vain vahvistettua muistia käytetään uusissa tarjouspyynnöissä. Jokainen asiakaskohtainen vastine näyttää lähteen, vahvistustilan ja käyttöhistorian."
      : "Only verified memory is reused on new RFQs. Every customer-specific mapping shows its source, verification state and usage history.",
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
    source: fi ? "Lähde" : "Source",
    confidence: fi ? "Varmuus" : "Confidence",
    verifiedAt: fi ? "Vahvistettu" : "Verified",
    lastUsed: fi ? "Viimeksi käytetty" : "Last used",
    never: fi ? "Ei vielä käytetty" : "Not used yet",
    unavailable: fi ? "Tuote ei ole enää saatavilla" : "Product is no longer available",
    inactive: fi ? "Tuote ei ole aktiivinen" : "Product is inactive",
    productSku: fi ? "Katalogin SKU" : "Catalogue SKU",
    save: fi ? "Tallenna / vahvista" : "Save / verify",
    deleteConfirm: fi
      ? "Vahvistan, että tämä vastine poistetaan aktiivisesta muistista."
      : "I confirm this mapping should be removed from active memory.",
    delete: fi ? "Poista muistista" : "Remove from memory",
    disabledNote: fi
      ? "Tämä muisti säilyy audit trailissa, mutta sitä ei enää käytetä matchingissa."
      : "This memory remains in the audit trail but is no longer used for matching.",
    empty: fi ? "Muisti on vielä tyhjä" : "No memory yet",
    emptyTitle: fi
      ? "Älykäs muisti kasvaa ihmisen vahvistamista päätöksistä."
      : "Smart Memory grows from human-confirmed decisions.",
    emptyBody: fi
      ? "Vahvista tuote RFQ Review -näkymässä ja valitse “Muista tämä vastine tälle asiakkaalle”."
      : "Confirm a product in RFQ Review and choose “Remember this mapping for this customer”.",
    step1: fi ? "Ihminen vahvistaa" : "Human confirms",
    step1Body: fi
      ? "Tuoteosuma hyväksytään RFQ Review:ssa."
      : "A product match is approved in RFQ Review.",
    step2: fi ? "Muisti tallentuu verified-tilaan" : "Memory becomes verified",
    step2Body: fi
      ? "Asiakkaan tunniste linkitetään katalogituotteeseen audit trailin kanssa."
      : "The customer identifier is linked to a catalogue product with an audit trail.",
    step3: fi ? "Seuraava RFQ saa ehdotuksen" : "The next RFQ gets a suggestion",
    step3Body: fi
      ? "Muistettu vastine priorisoidaan, mutta ihminen vahvistaa sen edelleen."
      : "The remembered mapping is prioritized, but a person still confirms it.",
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

      <section className="memory-app-v2-summary" aria-label="Smart Memory summary">
        <div>
          <span>{text.active}</span>
          <strong>{activeRows.length}</strong>
          <small>{fi ? "käytettävissä olevaa vastinetta" : "available mappings"}</small>
        </div>
        <div>
          <span>{text.verified}</span>
          <strong>{verifiedRows.length}</strong>
          <small>{fi ? "voidaan ehdottaa uudelleen" : "eligible for reuse"}</small>
        </div>
        <div>
          <span>{text.review}</span>
          <strong>{reviewRows.length}</strong>
          <small>{fi ? "ei käytetä automaattisesti" : "never reused automatically"}</small>
        </div>
        <div>
          <span>{text.uses}</span>
          <strong>{totalUses}</strong>
          <small>{fi ? "idempotenttia muistiosumaa" : "idempotent memory matches"}</small>
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

        {rows.length ? (
          <div className="memory-app-v2-rows">
            {rows.map((memory: any) => {
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
                  className={"memory-app-v2-row memory-m3-row" + (disabled ? " is-disabled" : "")}
                >
                  <div className="memory-app-v2-customer">
                    <span>{text.customer}</span>
                    <strong>{customer?.name ?? (fi ? "Tuntematon asiakas" : "Unknown customer")}</strong>
                    <small>{memorySourceLabel(String(memory.source || ""), metadata, fi)}</small>
                  </div>

                  <div className="memory-app-v2-input">
                    <span>{text.input}</span>
                    <h3>{memory.source_value || "—"}</h3>
                    <p>
                      {text.state}: {memoryStateLabel(state, fi)}
                    </p>
                  </div>

                  <div className="memory-app-v2-arrow" aria-hidden="true">→</div>

                  <div className="memory-app-v2-product">
                    <span>{text.product}</span>
                    <h3>{product?.sku ?? "—"}</h3>
                    <p>{product?.name ?? text.unavailable}</p>
                    {product?.manufacturer ? <small>{product.manufacturer}</small> : null}
                    {product && product.active === false ? (
                      <small className="memory-m3-warning">{text.inactive}</small>
                    ) : null}

                    {canEdit && !disabled ? (
                      <form action={updateCustomerMemoryMapping} className="memory-m3-edit">
                        <input type="hidden" name="memoryId" value={memory.id} />
                        <label>
                          <span>{text.productSku}</span>
                          <input
                            name="productSku"
                            required
                            defaultValue={product?.sku ?? ""}
                            aria-label={text.productSku}
                          />
                        </label>
                        <button className="btn-secondary">{text.save}</button>
                      </form>
                    ) : null}
                  </div>

                  <div className="memory-app-v2-uses memory-m3-meta">
                    <span>{text.uses}</span>
                    <strong>{uses}</strong>
                    <small>
                      {text.confidence}: {Math.round(Number(memory.confidence ?? 0))}%
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
                      <p className="memory-m3-disabled-note">{text.disabledNote}</p>
                    ) : canDelete ? (
                      <form action={deleteCustomerMemoryMapping} className="memory-m3-delete">
                        <input type="hidden" name="memoryId" value={memory.id} />
                        <label>
                          <input name="confirmDelete" type="checkbox" required />
                          <span>{text.deleteConfirm}</span>
                        </label>
                        <button className="btn-secondary">{text.delete}</button>
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

      <section className="memory-app-v2-explainer">
        <div>
          <span>1</span>
          <b>{text.step1}</b>
          <small>{text.step1Body}</small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>2</span>
          <b>{text.step2}</b>
          <small>{text.step2Body}</small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>3</span>
          <b>{text.step3}</b>
          <small>{text.step3Body}</small>
        </div>
      </section>
    </div>
  );
}
