import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { getBusinessCentralConfigurationStatus } from "@/lib/rivora/erp/business-central";
import { saveBusinessCentralMapping } from "./actions";

export default async function BusinessCentralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [query, locale, { supabase, workspace }] = await Promise.all([
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);
  const fi = locale === "fi";
  const canManage = ["owner", "admin"].includes(workspace.role);
  const config = getBusinessCentralConfigurationStatus(workspace.id);

  const [{ data: customers }, { data: products }, { data: mappings }] = await Promise.all([
    supabase
      .from("customers")
      .select("id,name,external_id")
      .eq("organization_id", workspace.id)
      .order("name")
      .limit(500),
    supabase
      .from("products")
      .select("id,sku,name,manufacturer,manufacturer_part_number,active")
      .eq("organization_id", workspace.id)
      .eq("active", true)
      .order("sku")
      .limit(500),
    supabase
      .from("erp_entity_mappings")
      .select("entity_type,local_entity_id,external_number,metadata,updated_at")
      .eq("organization_id", workspace.id)
      .eq("provider", "business_central"),
  ]);

  const mappingByEntity = new Map(
    (mappings ?? []).map((mapping: any) => [
      `${mapping.entity_type}:${mapping.local_entity_id}`,
      mapping,
    ]),
  );

  const mappedCustomers = (customers ?? []).filter((customer: any) =>
    mappingByEntity.has(`customer:${customer.id}`),
  ).length;
  const mappedProducts = (products ?? []).filter((product: any) =>
    mappingByEntity.has(`product:${product.id}`),
  ).length;

  return (
    <div className="app-page-v2">
      <div className="mb-5">
        <Link href="/app/settings#business-central" className="text-sm font-semibold">
          ← {fi ? "Asetukset" : "Settings"}
        </Link>
      </div>

      <header className="mb-7">
        <div className="app-kicker-v2">Business Central</div>
        <h1>{fi ? "Business Central -vastineet" : "Business Central mappings"}</h1>
        <p>
          {fi
            ? "Tarkista ja korjaa asiakas- ja tuotevastineet. Averomira käyttää näitä automaattisesti tulevissa tilauksissa."
            : "Review and correct customer and product mappings. Averomira reuses them automatically for future orders."}
        </p>
      </header>

      {query.saved ? (
        <div className="mb-5 rounded-xl border border-[#dfe7df] bg-[#f7faf7] p-4 text-sm text-[#426048]">
          {fi ? "Business Central -vastine tallennettiin." : "Business Central mapping saved."}
        </div>
      ) : null}

      <section className="surface p-5">
        <div className="settings-self-head settings-self-head-row">
          <div>
            <div className="upload-v2-section-label">{fi ? "Yhteys" : "Connection"}</div>
            <h2>{config.configured ? (fi ? "Yhteys valmis" : "Connection ready") : (fi ? "Yhteys vaatii huomiota" : "Connection needs attention")}</h2>
            <p>
              {fi
                ? "Salaisia tunnuksia ei näytetä tässä näkymässä."
                : "Secret credentials are never shown in this view."}
            </p>
          </div>
          <span className={config.configured ? "settings-status is-ready" : "settings-status is-warning"}>
            {config.configured ? (fi ? "Yhdistetty" : "Connected") : (fi ? "Vaatii huomiota" : "Needs attention")}
          </span>
        </div>

        <div className="settings-connection-grid">
          <div><span>{fi ? "Ympäristö" : "Environment"}</span><strong>{config.environment || "—"}</strong></div>
          <div><span>Company ID</span><strong>{config.companyId || "—"}</strong></div>
          <div><span>{fi ? "Asiakkaat" : "Customers"}</span><strong>{mappedCustomers}/{customers?.length ?? 0}</strong></div>
          <div><span>{fi ? "Tuotteet" : "Products"}</span><strong>{mappedProducts}/{products?.length ?? 0}</strong></div>
        </div>
      </section>

      <section className="surface mt-5 overflow-hidden">
        <div className="settings-self-head border-b border-[var(--line)] p-5">
          <div>
            <div className="upload-v2-section-label">{fi ? "Asiakkaat" : "Customers"}</div>
            <h2>{fi ? "Business Central -asiakasnumerot" : "Business Central customer numbers"}</h2>
          </div>
        </div>

        <div className="settings-mapping-list">
          {(customers ?? []).map((customer: any) => {
            const mapping = mappingByEntity.get(`customer:${customer.id}`) as any;
            return (
              <div key={customer.id} className="settings-mapping-row">
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.external_id || (fi ? "Ei ERP-tunnusta" : "No ERP ID")}</span>
                </div>
                <form action={saveBusinessCentralMapping}>
                  <input type="hidden" name="entityType" value="customer" />
                  <input type="hidden" name="localEntityId" value={customer.id} />
                  <input
                    name="externalNumber"
                    required
                    defaultValue={mapping?.external_number || ""}
                    placeholder={fi ? "BC asiakasnumero" : "BC customer number"}
                    disabled={!canManage}
                  />
                  {canManage ? <button className="btn-secondary">{fi ? "Tallenna" : "Save"}</button> : null}
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface mt-5 overflow-hidden">
        <div className="settings-self-head border-b border-[var(--line)] p-5">
          <div>
            <div className="upload-v2-section-label">{fi ? "Tuotteet" : "Products"}</div>
            <h2>{fi ? "Business Central -item-numerot" : "Business Central item numbers"}</h2>
            <p>
              {fi
                ? "Täytä käsin vain puuttuvat tai väärät vastineet."
                : "Only fill mappings that are missing or incorrect."}
            </p>
          </div>
        </div>

        <div className="settings-mapping-list">
          {(products ?? []).map((product: any) => {
            const mapping = mappingByEntity.get(`product:${product.id}`) as any;
            return (
              <div key={product.id} className="settings-mapping-row">
                <div>
                  <strong>{product.sku}</strong>
                  <span>
                    {[product.manufacturer, product.manufacturer_part_number, product.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <form action={saveBusinessCentralMapping}>
                  <input type="hidden" name="entityType" value="product" />
                  <input type="hidden" name="localEntityId" value={product.id} />
                  <input
                    name="externalNumber"
                    required
                    defaultValue={mapping?.external_number || ""}
                    placeholder="BC item no."
                    disabled={!canManage}
                  />
                  {canManage ? <button className="btn-secondary">{fi ? "Tallenna" : "Save"}</button> : null}
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
